# AURA — Implementation Plan (Revised — One-Day Aggressive Build)

## 1. Time Budget

**Total: ~12–14 hours of focused coding with AI assistance.**

Every phase has a hard time-box. When time is up, move on. Drop features, not phases.

---

## 2. Phase Schedule

```
Phase 0 ─ Setup                    [1.0 hour]    Hours 0–1
Phase 1 ─ Backend Core             [2.0 hours]   Hours 1–3
Phase 2 ─ CV Pipeline              [2.0 hours]   Hours 3–5
Phase 3 ─ RECHECK + Fusion         [1.5 hours]   Hours 5–6.5
Phase 4 ─ API + WebSocket          [1.0 hour]    Hours 6.5–7.5
Phase 5 ─ Frontend                 [2.5 hours]   Hours 7.5–10
Phase 6 ─ Integration + Polish     [1.5 hours]   Hours 10–11.5
Phase 7 ─ Demo Prep               [0.5 hour]    Hours 11.5–12
```

---

## 3. Phase Details

### Phase 0 — Setup (1 hour)

| Task | Time |
|---|---|
| Create venv, `requirements.txt`, install deps | 15 min |
| Download/curate 10-15 PCB image pairs OR generate synthetic | 20 min |
| Create 3 scenario JSON files | 15 min |
| Verify: `python -c "import cv2, fastapi, numpy"` | 5 min |
| Create file structure (all empty files) | 5 min |

**`requirements.txt`:**
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
opencv-python-headless>=4.10.0
numpy>=1.26.0
pydantic>=2.8.0
python-multipart>=0.0.9
```

Six dependencies. No scikit-learn (P2), no aiosqlite (P1), no scipy.

**✅ Done when**: Dependencies install cleanly. PCB images load in OpenCV. Scenario JSONs parse.

---

### Phase 1 — Backend Core (2 hours)

| Task | Time |
|---|---|
| `config.py` — all constants and thresholds | 10 min |
| `models.py` — all data models | 20 min |
| `state_machine.py` — transition table FSM | 15 min |
| `simulation.py` — VirtualCamera, VirtualRobot, VirtualSensors, VirtualLighting | 30 min |
| `scenarios.py` — JSON loader + manager | 10 min |
| `ws_manager.py` — WebSocket broadcast | 10 min |
| Unit test: state machine transitions | 10 min |
| Unit test: virtual robot motion | 5 min |
| Unit test: scenario loading | 5 min |

**✅ Done when**: State machine passes all transitions. Virtual robot tracks position. Scenarios load from JSON. `VirtualCamera` returns images from dataset.

---

### Phase 2 — CV Pipeline (2 hours)

**This is the highest-risk phase. Allocate full 2 hours.**

| Task | Time |
|---|---|
| `detector.py` — template diff detection pipeline | 40 min |
| Feature extraction (anomaly_score, area, edges, contrast) | 20 min |
| Defect localization (contour → bounding boxes) | 15 min |
| Defect classification (rule-based geometric) | 10 min |
| `scoring.py` — defect score calculation | 10 min |
| **TEST on 5+ image pairs** | 15 min |
| **TUNE thresholds** for 3 scenarios | 10 min |

**✅ Done when**: Running `detector.analyze(test_img, template)` produces:
- Clean image → defect score < 0.30
- Obvious defect → defect score > 0.70
- Subtle defect → defect score 0.30–0.70 (RECHECK zone)

**⚠️ If this phase fails**: Switch to synthetic images or scenario-guided ROI analysis immediately. Do not spend more than 30 minutes debugging image-level issues.

---

### Phase 3 — RECHECK + Evidence Fusion (1.5 hours)

| Task | Time |
|---|---|
| Evidence fusion in `scoring.py` (weighted average) | 15 min |
| Decision evaluation (score vs thresholds) | 10 min |
| Recheck view generation (crop + enhance) | 15 min |
| `inspection_engine.py` — full orchestrator | 30 min |
| Test: RECHECK scenario end-to-end (CLI/script) | 15 min |
| Tune recheck scenario for demo impact | 5 min |

**✅ Done when**: Running the RECHECK scenario programmatically produces:
```
Observation 1: score=0.48, decision=RECHECK
Observation 2: score=0.78
Fusion: fused_score=0.63
Final: FAIL
```

---

### Phase 4 — API + WebSocket (1 hour)

| Task | Time |
|---|---|
| `main.py` — FastAPI app, 5 REST endpoints | 25 min |
| WebSocket route + event broadcasting | 15 min |
| `run.py` — entry point | 5 min |
| Test: `POST /api/inspection/start` → full cycle via API | 10 min |
| Test: WebSocket events stream (browser console or wscat) | 5 min |

**✅ Done when**: Starting server with `python run.py`, hitting `POST /api/inspection/start`, and receiving WebSocket events for the full RECHECK cycle.

---

### Phase 5 — Frontend (2.5 hours)

**DO NOT sacrifice CV/backend quality for frontend features.**

| Task | Time |
|---|---|
| `index.html` — page structure, layout | 15 min |
| `styles.css` — dark theme, grid layout | 20 min |
| `app.js` — WebSocket connection + event routing | 15 min |
| `app.js` — Scenario selector + Start button | 10 min |
| `app.js` — Dashboard (defect score, confidence, state display) | 15 min |
| `app.js` — PCB image display + defect overlay | 20 min |
| `app.js` — Canvas cell view (PCB + robot position) | 20 min |
| `app.js` — Timeline bar | 15 min |
| `app.js` — Explanation/reasoning panel | 10 min |
| End-to-end test in browser | 10 min |

**✅ Done when**: Open browser → select RECHECK scenario → click Start → see full animated cycle → RECHECK highlighted → decision shown with reasoning.

**Drop order within Phase 5**:
1. Smooth robot animation → use instant position jumps
2. Defect overlay → just show the image
3. Canvas cell view → show image + text state
4. Timeline bar → show text event log

---

### Phase 6 — Integration + Polish (1.5 hours)

| Task | Time |
|---|---|
| `explainer.py` — structured explanation | 15 min |
| Test all 3 scenarios end-to-end in browser | 15 min |
| Error handling (try/except in engine, error banner in UI) | 10 min |
| Reset between inspections | 10 min |
| Fix bugs found during testing | 15 min |
| Visual polish (colors, transitions, spacing) | 10 min |
| WebSocket reconnection logic | 5 min |

**✅ Done when**: All 3 scenarios work. Reset works. No console errors. UI looks professional.

---

### Phase 7 — Demo Prep (0.5 hour)

| Task | Time |
|---|---|
| Write `README.md` (setup + run instructions) | 10 min |
| Final end-to-end test on clean terminal | 10 min |
| Prepare demo talking points | 5 min |
| Record backup demo video (optional) | 5 min |

**✅ Done when**: Fresh terminal → `pip install -r requirements.txt` → `python run.py` → browser → demo flows.

---

## 4. Critical Path

```
Phase 2 (CV) → Phase 3 (RECHECK) → Phase 4 (API) → Phase 5 (Frontend)
```

Phases 0 and 1 are prerequisites. Phase 6 and 7 are polish.

**If Phase 2 takes too long**: Everything downstream is at risk. This is why it has a 2-hour allocation and explicit fallback strategies.

---

## 5. Drop Order When Time Runs Short

Delete in this exact order. Each deletion saves ~15-30 minutes.

```
 1. SQLite persistence           → use in-memory dict              [saves 20 min]
 2. Defect heatmap              → just show the image               [saves 15 min]
 3. Simulated sensors (P1)      → visual evidence only              [saves 15 min]
 4. Canvas robot animation      → use position text/dots            [saves 20 min]
 5. Timeline bar                → show text event log               [saves 15 min]
 6. Explanation panel           → show raw reasoning array          [saves 15 min]
 7. Defect overlay on image     → show image + text defect list     [saves 10 min]
 8. Dark theme polish           → use system defaults               [saves 15 min]

 NEVER DROP:
 ✗ OpenCV detection pipeline
 ✗ Defect scoring
 ✗ RECHECK trigger
 ✗ Evidence fusion
 ✗ Three scenarios
 ✗ WebSocket state streaming
 ✗ Basic HTML showing the cycle
```

---

## 6. Definition of Done — Vertical Slice

The demo is DONE when:

- [ ] `python run.py` starts the server
- [ ] Browser at `http://localhost:8000` shows UI
- [ ] User can select from 3 scenarios
- [ ] **Scenario A (Clean Board)**: observe → low score → PASS → robot passes
- [ ] **Scenario B (Obvious Defect)**: observe → high score → FAIL → robot rejects
- [ ] **Scenario C (RECHECK DEMO)**:
  - [ ] Robot positions → camera captures → **real OpenCV runs**
  - [ ] Defect score ~0.48 displayed (ambiguous zone)
  - [ ] **RECHECK triggered automatically** (no user action)
  - [ ] Robot repositions (visibly different position)
  - [ ] Second image captured (visibly different from first)
  - [ ] Evidence fusion: weighted score ~0.63
  - [ ] Final decision: **FAIL**
  - [ ] Reasoning chain displayed
  - [ ] Timeline visible
- [ ] System can reset and run another scenario
- [ ] All scores are derived from real image features (not hardcoded)
- [ ] All simulated components are labeled

---

## 7. Judge Demo Script

### Opening (30 seconds)

> "This is AURA — an autonomous inspection system. Unlike conventional inspect-and-classify systems, AURA knows when it's uncertain and actively seeks more evidence before making a decision."

### Demo 1: Clean Board → PASS (30 seconds)

> "Let's start with a clean board."

- Select "Clean Board" → Start
- Watch: robot positions → captures → analyzes → **defect score 0.08** → **PASS**
- "The system is confident this board is clean. Score well below the PASS threshold."

### Demo 2: Obvious Defect → FAIL (30 seconds)

> "Now a board with a clear defect."

- Reset → Select "Obvious Defect" → Start
- Watch: robot positions → captures → analyzes → **defect score 0.87** → **FAIL**
- "Clear open circuit detected. High score, confident FAIL."

### Demo 3: The RECHECK (Main Event) (90 seconds)

> "Now the interesting case. This board has a subtle solder bridge — barely visible."

- Reset → Select "Subtle Solder Bridge" → Start
- Watch: robot positions → captures → analyzes
- **"Defect score: 0.48.** The system can't confidently pass or fail."
- **"Watch — RECHECK triggered. The system autonomously decides to look again."**
- Watch: robot repositions (closer, angled)
- "Different viewpoint. Different lighting. Genuinely different image."
- Watch: second analysis → **"Score: 0.78. Much clearer."**
- Watch: evidence fusion
- **"Fused score: 0.63. Exceeds the FAIL threshold. Decision: FAIL."**
- "Here's the reasoning chain..." (show explanation panel)

### Closing (30 seconds)

> "Every observation uses real OpenCV on real images. The defect score is a computed heuristic, not a probability — and we say so explicitly. The robot, camera, and sensors are simulated with clean interfaces — swap in real hardware and the inspection logic doesn't change."

**Total demo: ~3 minutes.**

---

## 8. Expected Judge Questions & Prepared Answers

See `ARCHITECTURE.md` §12 for the complete Q&A covering:
- Why RECHECK?
- What's real AI?
- What's simulated?
- How is scoring done?
- Is this scripted?
- Hardware migration?
- Conflicting evidence?
- Trust in results?

---

## 9. One-Day Build Order (Exact Sequence)

```
 1. python -m venv venv && pip install requirements
 2. Create file structure (empty .py files)
 3. Prepare PCB images (download or generate synthetic)
 4. Create 3 scenario JSON files
 5. config.py (thresholds, timing)
 6. models.py (all dataclasses)
 7. state_machine.py (transition table)
 8. simulation.py (virtual camera, robot, sensors, lighting)
 9. scenarios.py (JSON loader)
10. ws_manager.py (WebSocket broadcast)
11. detector.py (OpenCV pipeline)
12. *** TEST: detector on 5+ images — MUST produce score variation ***
13. scoring.py (defect score, confidence, fusion, evaluation)
14. inspection_engine.py (orchestrator)
15. *** TEST: run RECHECK scenario programmatically ***
16. main.py (FastAPI routes + WebSocket)
17. run.py (entry point)
18. *** TEST: full cycle via REST API + WebSocket ***
19. index.html (layout)
20. styles.css (dark theme)
21. app.js (everything: WS, Canvas, dashboard, timeline)
22. *** TEST: full cycle in browser ***
23. explainer.py (structured explanation)
24. Connect explanation to frontend
25. Test all 3 scenarios
26. Fix bugs
27. Polish
28. README.md
29. Final test
```

Steps 12, 15, 18, 22 are **mandatory checkpoints**. If any fails, stop and fix before proceeding.
