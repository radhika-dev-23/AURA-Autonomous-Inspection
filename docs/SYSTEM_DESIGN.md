# AURA — System Design (Revised)

## 1. Design Principle

**Fewer files, fewer abstractions, fewer failure points.** Every component is justified by the MVP vertical slice. Nothing exists "for completeness."

---

## 2. Inspection Engine — The Orchestrator

The orchestrator is the single coordinator. It calls every subsystem in order.

```python
class InspectionEngine:
    def __init__(self, robot, camera, sensors, lighting,
                 detector, scoring, fusion, scenarios, ws_manager):
        self.robot = robot
        self.camera = camera
        self.sensors = sensors
        self.lighting = lighting
        self.detector = detector
        self.scoring = scoring
        self.fusion = fusion
        self.scenarios = scenarios
        self.ws = ws_manager
        self.fsm = StateMachine()
        self.current: Optional[Inspection] = None

    async def run_inspection(self, scenario_id: str) -> Inspection:
        scenario = self.scenarios.load(scenario_id)
        ctx = Inspection(id=make_id(), scenario_id=scenario_id, ...)

        # Phase 1: First observation
        await self._transition(ctx, State.POSITIONING)
        await self.robot.move_to(scenario.positions[0])

        await self._transition(ctx, State.ACQUIRING)
        image = await self.camera.capture(scenario.positions[0])

        await self._transition(ctx, State.ANALYZING)
        template = cv2.imread(scenario.template_image)
        result = self.detector.analyze(image, template)
        ctx.observations.append(Observation(..., analysis=result))

        # Phase 2: Evaluate
        await self._transition(ctx, State.EVALUATING)
        decision_type = self.scoring.evaluate(result.defect_score, ctx.recheck_count)

        if decision_type == "RECHECK" and ctx.recheck_count < MAX_RECHECKS:
            # Phase 3: RECHECK
            await self._transition(ctx, State.RECHECKING)
            ctx.recheck_count += 1
            self.scenarios.advance()

            await self.lighting.set_mode("angled", 1.0)
            recheck_pos = scenario.positions[min(1, len(scenario.positions)-1)]

            await self._transition(ctx, State.POSITIONING)
            await self.robot.move_to(recheck_pos)

            await self._transition(ctx, State.ACQUIRING)
            image2 = await self.camera.capture(recheck_pos)

            await self._transition(ctx, State.ANALYZING)
            result2 = self.detector.analyze(image2, template)
            ctx.observations.append(Observation(..., analysis=result2))

            # Phase 4: Fuse evidence
            await self._transition(ctx, State.FUSING)
            evidence = self._collect_evidence(ctx)
            fused = self.fusion.fuse(evidence)
            ctx.fused_score = fused.fused_defect_score

            await self._transition(ctx, State.EVALUATING)
            decision_type = self.scoring.evaluate(fused.fused_defect_score,
                                                    ctx.recheck_count, is_fused=True)

        # Phase 5: Decide + Act
        await self._transition(ctx, State.DECIDING)
        final_score = ctx.fused_score or result.defect_score
        ctx.decision = Decision(result=decision_type, defect_score=final_score, ...)

        await self._transition(ctx, State.ACTING)
        action = "pass_lane" if decision_type == "PASS" else "reject_bin"
        await self.robot.perform_action(action)

        await self._transition(ctx, State.COMPLETE)
        return ctx

    async def _transition(self, ctx, new_state):
        old = ctx.current_state
        ctx.current_state = new_state
        ctx.timeline.append(TimelineEvent(state=new_state, ...))
        await self.ws.broadcast({
            "type": "state_change",
            "inspection_id": ctx.id,
            "from_state": old, "to_state": new_state,
            "timestamp": datetime.utcnow().isoformat(),
        })
```

### Key Design Decisions

- **Single `async def run_inspection()`**: The entire pipeline is one function. No callbacks, no event chains. Easy to read, easy to debug.
- **Wrapped in try/except**: Any exception transitions to ERROR state and broadcasts the error.
- **Single inspection at a time**: No concurrency. No race conditions.

---

## 3. Detector — OpenCV Pipeline

A **stateless function**: image in → `AnalysisResult` out.

```python
class DefectDetector:
    def analyze(self, test_image: np.ndarray,
                template_image: np.ndarray) -> AnalysisResult:
        # 1. Grayscale
        # 2. cv2.absdiff
        # 3. cv2.threshold
        # 4. Morphological cleanup
        # 5. cv2.findContours
        # 6. Filter + classify
        # 7. Extract features
        # 8. Calculate defect score
        # → Returns AnalysisResult
```

**Every step is real OpenCV computation.** See `AI_INSPECTION_DESIGN.md` for full implementation.

---

## 4. Scoring Module

Contains three distinct functions:

```python
# 1. Defect Score — heuristic, NOT probability
def calculate_defect_score(features: FeatureVector) -> float

# 2. Decision Confidence — informational clarity metric
def calculate_decision_confidence(score, evidence_count, agreement) -> float

# 3. Decision Evaluation — threshold comparison
def evaluate_score(score, recheck_count, is_fused) -> str  # "PASS"/"FAIL"/"RECHECK"
```

See `AI_INSPECTION_DESIGN.md` §4 for formulas.

---

## 5. Evidence Fusion Module

One function:

```python
def fuse_evidence(items: List[EvidenceItem]) -> FusedResult
```

Reliability-weighted average. See `AI_INSPECTION_DESIGN.md` §5.

---

## 6. Explanation Engine

Generates structured reasoning — no LLM.

```python
class Explainer:
    def explain(self, inspection: Inspection) -> Dict:
        sections = []

        # Observation summary
        sections.append({
            "title": "Observations",
            "content": f"{len(inspection.observations)} observation(s) taken."
                       f" RECHECK count: {inspection.recheck_count}."
        })

        # Per-observation details
        for obs in inspection.observations:
            sections.append({
                "title": f"Observation {obs.observation_number}",
                "content": f"Defect score: {obs.analysis.defect_score:.2f}",
                "features": obs.analysis.features.__dict__,
                "defects_found": len(obs.analysis.defects)
            })

        # Fusion (if applicable)
        if inspection.fused_score is not None:
            sections.append({
                "title": "Evidence Fusion",
                "content": f"Fused defect score: {inspection.fused_score:.2f}",
                "method": "reliability_weighted_average"
            })

        # Decision
        d = inspection.decision
        sections.append({
            "title": "Decision",
            "content": f"{d.result} (defect score: {d.defect_score:.2f},"
                       f" confidence: {d.decision_confidence:.2f})",
            "reasoning": d.reasoning
        })

        return {"sections": sections}
```

**The LLM is NOT used.** If time permits (P2), a future version could pass this structured output to an LLM for natural-language paraphrasing — but the LLM NEVER makes decisions.

---

## 7. WebSocket Manager

```python
class WSManager:
    def __init__(self):
        self.connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    async def disconnect(self, ws: WebSocket):
        self.connections.remove(ws)

    async def broadcast(self, message: dict):
        data = json.dumps(message, default=str)
        dead = []
        for ws in self.connections:
            try:
                await ws.send_text(data)
            except:
                dead.append(ws)
        for ws in dead:
            self.connections.remove(ws)
```

---

## 8. FastAPI Application (main.py)

Single file containing:
- App creation
- Startup: wire all components
- REST routes (5 endpoints)
- WebSocket route
- Static file mounting

```python
app = FastAPI(title="AURA Inspection System")

# Startup
@app.on_event("startup")
async def startup():
    # Create simulation layer
    app.state.scenarios = ScenarioManager("data/scenarios")
    app.state.camera = VirtualCamera(app.state.scenarios)
    app.state.robot = VirtualRobot()
    app.state.sensors = VirtualSensors(app.state.scenarios)
    app.state.lighting = VirtualLighting()
    app.state.detector = DefectDetector()
    app.state.scoring = Scoring()
    app.state.fusion = EvidenceFusion()
    app.state.ws = WSManager()
    app.state.engine = InspectionEngine(...)
    app.state.store = {}  # In-memory inspection store

# Routes
@app.get("/api/system/status")
@app.get("/api/scenarios")
@app.post("/api/inspection/start")
@app.get("/api/inspection/{inspection_id}")
@app.post("/api/system/reset")

# WebSocket
@app.websocket("/ws")

# Static files
app.mount("/", StaticFiles(directory="frontend", html=True))
```

---

## 9. Frontend Architecture

### 9.1 Single-Page App (No Framework)

Three files total:

| File | Responsibility |
|---|---|
| `index.html` | Layout: cell view, dashboard, timeline, explanation |
| `styles.css` | Dark theme, all styles, responsive layout |
| `app.js` | All JavaScript: WebSocket, Canvas rendering, DOM updates |

### 9.2 Layout

```
┌───────────────────────────────────────────────────────────┐
│  AURA — Autonomous Inspection System        [Status: ●]   │
├──────────────────────────┬────────────────────────────────┤
│                          │                                │
│   Inspection Cell        │   Dashboard                    │
│   (Canvas)               │   ┌──────────────────────────┐ │
│                          │   │ Defect Score:  0.48      │ │
│   ┌──────────────────┐   │   │ Confidence:    LOW       │ │
│   │  [PCB Image]     │   │   │ Decision:      RECHECK   │ │
│   │  [Defect Overlay]│   │   │ Observation:   1 / 2     │ │
│   │  [Robot ●]       │   │   │ State:         RECHECKING│ │
│   └──────────────────┘   │   ├──────────────────────────┤ │
│                          │   │ Feature Breakdown         │ │
│                          │   │ ▓▓▓▓░░ Anomaly  0.40     │ │
│   [Scenario: ▼ Select]   │   │ ▓▓░░░░ Area     0.01     │ │
│   [▶ Start Inspection]   │   │ ▓▓▓░░░ Edge     0.35     │ │
│                          │   └──────────────────────────┘ │
├──────────────────────────┴────────────────────────────────┤
│  Timeline                                                  │
│  ●──●──●──●──◆──●──●──●──●──●                             │
│  POS ACQ ANA EVL RCHK POS ACQ FUS DEC ACT                │
├───────────────────────────────────────────────────────────┤
│  Explanation / Reasoning                                   │
│  1. Observation 1: defect score 0.48 (ambiguous)          │
│  2. RECHECK triggered — robot repositioned                │
│  3. Observation 2: defect score 0.78 (confirmed)          │
│  4. Evidence fusion: weighted score 0.63                   │
│  5. Decision: FAIL — exceeds threshold 0.60               │
└───────────────────────────────────────────────────────────┘
```

### 9.3 Canvas Cell Renderer

Simple 2D top-down view:
- PCB image (scaled from dataset image)
- Defect overlay (colored rectangles on detected regions)
- Robot position indicator (circle/dot that moves)
- State label
- Pass lane / reject bin indicators

All rendering in Canvas using `requestAnimationFrame`. If Canvas animation is too complex, fall back to static image + position text.

---

## 10. Error Handling

```python
class AURAError(Exception): pass
class HardwareError(AURAError): pass
class PipelineError(AURAError): pass

# In inspection engine:
try:
    result = await self.run_inspection(scenario_id)
except Exception as e:
    await self._transition(ctx, State.ERROR)
    await self.ws.broadcast({"type": "error", "message": str(e)})
```

Frontend shows error banner with "Reset System" button. Reset returns to IDLE.

---

## 11. What Each Backend File Does

| File | Lines (est.) | P0? | Purpose |
|---|---|---|---|
| `main.py` | ~150 | P0 | FastAPI app, routes, startup wiring |
| `config.py` | ~40 | P0 | All constants and thresholds |
| `models.py` | ~120 | P0 | All data models |
| `state_machine.py` | ~60 | P0 | FSM transitions |
| `inspection_engine.py` | ~150 | P0 | Pipeline orchestrator |
| `detector.py` | ~120 | P0 | OpenCV analysis |
| `scoring.py` | ~80 | P0 | Defect score, confidence, fusion, evaluation |
| `simulation.py` | ~150 | P0 | Virtual camera, robot, sensors, lighting |
| `scenarios.py` | ~40 | P0 | Scenario loading |
| `explainer.py` | ~60 | P1 | Structured explanation |
| `ws_manager.py` | ~30 | P0 | WebSocket broadcast |

**Total backend estimate: ~1,000 lines of Python.** Achievable in one day.
