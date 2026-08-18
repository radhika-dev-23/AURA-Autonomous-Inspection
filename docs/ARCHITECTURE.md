# AURA — System Architecture (Revised for One-Day Build)

> Autonomous Uncertainty-Aware Robotic Inspection Assistant

---

## 1. MVP Vertical Slice — The Only Mandatory Path

```
Scenario Selection
  → Virtual Robot Positioning
    → Virtual Camera Acquisition
      → Real OpenCV Analysis
        → Feature Extraction
          → Defect Score Calculation
            → Decision Evaluation (score vs thresholds)
              ┌─── Score Clear ──→ PASS or FAIL
              └─── Score Ambiguous ──→ RECHECK
                → Robot Changes Viewpoint
                  → Second Observation
                    → Evidence Fusion (weighted aggregation)
                      → Final PASS/FAIL
                        → Robot Action (pass lane / reject bin)
                          → Structured Explanation
                            → Live Timeline
```

**Nothing else is required for the demo.**

---

## 2. Feature Priority

### P0 — Absolutely Mandatory

| Feature | Why |
|---|---|
| OpenCV template-difference defect detection | Real CV on real images — the computer vision inspection core |
| Feature extraction (anomaly score, area, edges) | Drives the defect score — not fabricated |
| Defect score (0–1 heuristic, NOT a probability) | Determines PASS/FAIL/RECHECK |
| RECHECK trigger when defect score is ambiguous | Central differentiating feature |
| Robot reposition to different viewpoint for recheck | Shows autonomous behavior |
| Second observation with genuinely different evidence | RECHECK must add value |
| Weighted evidence fusion (clearly named, not fake Bayesian) | Combines observations |
| Final PASS/FAIL with structured reasoning chain | Interpretable output |
| WebSocket real-time state streaming | Live visualization |
| Frontend: cell view, PCB image, defect overlay, scores, timeline | Judge-facing |
| Basic bounding-box defect overlay on PCB image | Visual proof of detection |
| Structured explanation panel (reasoning chain) | Interpretability — must show why |
| Three hero scenarios: PASS, FAIL, RECHECK→FAIL | Cover all decision paths |
| Offline-capable with bundled/synthetic images | Must work without internet |

### P1 — Important If Time Permits

| Feature | Why |
|---|---|
| Simulated thermal/electrical sensors (marked [SIMULATED]) | Multimodal story |
| Defect heatmap overlay (fancy gradient, beyond basic bounding boxes) | Visual polish |
| Smooth Canvas robot animation (interpolated motion) | Visual polish |
| SQLite inspection logging | Persistence (but in-memory fallback is fine) |
| Multiple defect type classification | Richness |

### P2 — Remove from One-Day Build

| Feature | Do Not Build |
|---|---|
| Replay/playback engine | Not core story |
| LLM natural-language explanation | Fragile, requires API key |
| Judge image upload | Too complex |
| Multiple concurrent inspections | Single-user demo |
| Authentication | No value |
| Docker / K8s / Redis / Celery | Infrastructure overkill |
| PostgreSQL | Use in-memory dict or optional SQLite |
| 3D visualization | Scope explosion |
| ML model training pipeline | Use rule-based or pre-trained |
| CI/CD | Not a hackathon concern |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   BROWSER (Single Page)                      │
│  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ Cell View  │ │ Scores & │ │ State    │ │ Explanation │  │
│  │ (Canvas)   │ │ Decision │ │ Timeline │ │ Panel       │  │
│  └──────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
│         └─────────────┼───────────┘               │         │
│                  WebSocket + REST                  │         │
└──────────────────┬────┼────────────────────────────┘─────────┘
                   │    │
═══════════════════╪════╪══════════════════════════════════════
                   ▼    ▼
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Server (single process)                  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Inspection Engine (Orchestrator)          │  │
│  │                                                       │  │
│  │  State Machine ──→ Detector ──→ Scoring ──→ Fusion   │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │          Hardware Abstraction Layer (HAL)              │  │
│  │  Camera │ Robot │ Sensors [SIMULATED] │ Lighting      │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                    │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │          Simulation Layer (Digital Twin)               │  │
│  │  VirtualCamera │ VirtualRobot │ VirtualSensors        │  │
│  │  ScenarioManager (3 hero scenarios)                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Technology Stack

| Layer | Technology | Why This, Not That |
|---|---|---|
| **Backend** | Python 3.11+, FastAPI, Uvicorn | Native OpenCV/NumPy ecosystem; async WebSocket support; zero-boilerplate API; auto-generated docs |
| **CV** | OpenCV 4.x (headless) | CPU-only, deterministic, fast template comparison; no GPU needed; battle-tested |
| **Numerical** | NumPy | Array operations, feature math |
| **Frontend** | Vanilla HTML/CSS/JS + Canvas | Zero build step = zero toolchain failures; full control; instant reload |
| **Real-time** | WebSocket (native) | Bidirectional push for live state |
| **Persistence** | In-memory dict (default), SQLite (P1 optional) | Zero config; SQLite only if time permits |
| **Dataset** | DeepPCB (bundled subset) + synthetic fallback | Real annotated PCB images; synthetic backup for offline |

### Rejected Technologies

| Technology | Why Rejected |
|---|---|
| React / Vue / Angular | Build toolchain = failure risk for live demo |
| Three.js / WebGL | "Do not build a 3D game" |
| PyTorch / TensorFlow | GPU dependency, training complexity, unnecessary for template comparison |
| PostgreSQL / MongoDB | Infrastructure overhead for zero benefit |
| Docker / K8s | Deployment complexity; `python run.py` is reliable |
| Redis / Celery | Async queues unnecessary for sequential pipeline |
| Flask | No native async, no native WebSocket |
| scikit-learn | ML classifier is P2; rule-based classification is P0 |

---

## 5. Repository Structure

```
AURA-Autonomous-Inspection/
│
├── docs/                              # Architecture documents
│
├── backend/
│   ├── __init__.py
│   ├── main.py                        # FastAPI app, routes, startup, static serving
│   ├── config.py                      # All constants, thresholds, timing
│   ├── models.py                      # All data models (dataclasses + Pydantic)
│   ├── state_machine.py               # Inspection FSM
│   ├── inspection_engine.py           # Pipeline orchestrator
│   ├── detector.py                    # OpenCV defect detection + feature extraction
│   ├── scoring.py                     # Defect scoring + evidence fusion + decision
│   ├── simulation.py                  # Virtual camera, robot, sensors, lighting (ONE file)
│   ├── scenarios.py                   # Scenario loader + manager
│   ├── explainer.py                   # Structured explanation generator
│   └── ws_manager.py                  # WebSocket connection manager
│
├── frontend/
│   ├── index.html                     # Single page, full layout
│   ├── styles.css                     # Dark theme, all styles
│   └── app.js                         # ALL JavaScript (single file)
│
├── data/
│   ├── scenarios/                     # 3 JSON scenario files
│   │   ├── clean_board.json
│   │   ├── obvious_defect.json
│   │   └── ambiguous_recheck.json
│   └── images/
│       ├── templates/                 # Defect-free reference images
│       ├── test/                      # Test images (some defective)
│       └── synthetic/                 # Fallback: generated PCB images
│
├── requirements.txt
├── run.py                             # python run.py → starts everything
└── README.md
```

**File count**: 11 backend Python files, 3 frontend files, 3 scenario JSONs, ~10-20 images.

---

## 6. Data Flow — Complete Inspection Cycle

```
1. User selects scenario           REST: POST /api/inspection/start
                                        │
2. Scenario loads                  ◄────┘
   PCB placed in cell                   │
                                        │
3. Robot moves to position #1      WS → state_change (POSITIONING)
   (simulated delay: ~2s)               │
                                        │
4. Camera captures image           WS → image_acquired
   (loads real PCB image)               │
                                        │
5. OpenCV analysis runs            WS → analysis_complete
   (REAL computation)                   │
   → template diff                      │
   → contour detection                  │
   → feature extraction                 │
   → DEFECT SCORE calculated            │
                                        │
6. Score evaluated vs thresholds   WS → score_update
                                        │
   ┌─── Score < 0.30 (clear) ─────── PASS ───┐
   │                                          │
   ├─── Score > 0.70 (clear) ─────── FAIL ───┤
   │                                          │
   └─── 0.30 ≤ Score ≤ 0.70 ───── RECHECK   │
        (AMBIGUOUS)                    │      │
                                       │      │
7. RECHECK:                            │      │
   Robot repositions              WS → recheck_triggered
   (different viewpoint)               │
   Camera captures again               │
   OpenCV re-analyzes                  │
   (DIFFERENT evidence)                │
                                       │
8. Evidence fusion                WS → evidence_fused
   Weighted score aggregation          │
                                       │
9. Final decision                 WS → decision_made
   Score vs final thresholds           │
                                       │
10. Robot acts                    WS → action_performed
    (pass lane or reject bin)          │
                                       │
11. Explanation generated         WS → inspection_complete
    Timeline finalized                 │
```

---

## 7. Defect Score vs Decision Confidence — Clear Separation

### Defect Score (D)

A **heuristic measure** of how defective the PCB appears, derived from OpenCV image analysis.

- Range: 0.0 (clean) to 1.0 (clearly defective)
- **NOT a calibrated probability**
- Derived from weighted combination of image features
- Drives the PASS/FAIL/RECHECK decision

### Decision Confidence (C)

A **clarity metric** showing how clear-cut the decision is.

- Range: 0.0 (completely ambiguous) to 1.0 (unambiguous)
- Derived from: distance of defect score from 0.5, evidence agreement, observation count
- **Informational only** — does not drive the decision
- Shown to the judge to explain why RECHECK was triggered

```
Defect Score:  0.05  →  Decision: PASS    Confidence: 0.90 (clear)
Defect Score:  0.92  →  Decision: FAIL    Confidence: 0.84 (clear)
Defect Score:  0.48  →  Decision: RECHECK Confidence: 0.04 (ambiguous)
```

---

## 8. LLM Policy

> **The LLM NEVER makes PASS/FAIL/RECHECK decisions.**

The deterministic inspection engine owns the decision pipeline:
1. OpenCV extracts features
2. Scoring computes defect score
3. Thresholds determine the decision
4. Evidence fusion combines observations

An LLM (if present at all) may ONLY:
- Convert structured reasoning arrays into fluent natural language
- Paraphrase — never invent

The structured explanation is ALWAYS the ground truth.

**For the one-day build**: Skip LLM integration entirely. Use the structured explanation directly.

---

## 9. Hardware Migration Path

| Virtual Component | HAL Interface | Future Physical Hardware |
|---|---|---|
| `VirtualCamera` | `CameraInterface.capture()` | USB/GigE camera via OpenCV |
| `VirtualRobot` | `RobotInterface.move_to()` | Serial robotic arm / XY gantry |
| `VirtualSensors` | `SensorInterface.read_all()` | ESP32 + I²C sensors |
| `VirtualLighting` | `LightingInterface.set_mode()` | PWM LED array |

Migration: implement the interface against real hardware, change `HARDWARE_MODE` in config.

---

## 10. Deployment

```
python run.py
  └── Uvicorn on port 8000
        ├── REST API  (/api/*)
        ├── WebSocket (/ws)
        └── Static files (frontend/)

Browser → http://localhost:8000
```

No Docker. No nginx. No cloud. No reverse proxy. One command.

---

## 11. Technical Honesty Declaration

### Real Computation (Genuine)
| Component | What Is Real |
|---|---|
| Template difference detection | Actual `cv2.absdiff()` on actual pixel data |
| Contour detection | Actual `cv2.findContours()` producing actual bounding boxes |
| Feature extraction | Actual statistical measures (mean, std, area ratios) from actual images |
| Defect scoring | Actual weighted combination of actual features |
| Evidence fusion | Actual weighted average of actual defect scores |
| Decision logic | Actual threshold comparison — deterministic, auditable |
| State machine | Actual FSM with actual transition guards |

### Simulated Components (Virtual — Clearly Labeled)
| Component | What Is Simulated | Label |
|---|---|---|
| Camera images | Loaded from dataset, not captured live | Image source: dataset |
| Robot motion | Position interpolation + delay, not physical movement | [VIRTUAL ROBOT] |
| Sensor readings | Generated from scenario config + Gaussian noise | [SIMULATED SENSOR] |
| Lighting effects | Image brightness/contrast transforms | [VIRTUAL LIGHTING] |
| PCB workpiece | Image from dataset, not physical board | [VIRTUAL PCB] |

### Heuristic Components (Honest Limitations)
| Component | Nature | What It Is NOT |
|---|---|---|
| Defect score | Weighted feature heuristic | Not a calibrated probability |
| Decision confidence | Distance-from-ambiguity metric | Not a statistical confidence interval |
| Defect classification | Geometric rules (aspect ratio, area, solidity) | Not a trained ML classifier |
| Sensor→evidence conversion | Scenario-defined mapping | Not physical measurement |

### Assumptions
- Test PCB matches a known template design
- Defect-free reference image is available for each PCB design
- Different lighting/viewpoint can reveal additional information (simulated)
- Single PCB at a time, single operator

### Limitations
- Cannot detect defects invisible in 2D images
- Cannot generalize to PCB designs outside the dataset
- Simulated sensors provide scenario-defined values, not physical readings
- Defect classification accuracy limited by geometric rules
- Template alignment assumes minimal geometric distortion

---

## 12. Judge Questions & Answers

### Q: Why is RECHECK necessary?
**A**: Conventional inspection makes a single pass — if the evidence is ambiguous, it guesses. AURA recognizes uncertainty and autonomously seeks additional evidence before deciding. This reduces both false accepts (defective boards passing) and false rejects (good boards rejected).

### Q: Why not simply classify the first image?
**A**: Because a single viewpoint may not reveal enough. A subtle solder bridge may be nearly invisible under direct lighting but clearly visible under angled lighting. AURA's RECHECK mechanism changes the observation conditions to gather genuinely different evidence, just as a human inspector would tilt the board to get a better look.

### Q: What makes this autonomous?
**A**: The system decides on its own whether to accept the first observation or seek more evidence. It plans where to look next (viewpoint, lighting), repositions the virtual robot, acquires a new image, and fuses the evidence — all without human intervention. The entire loop from uncertainty detection to re-inspection is automatic.

### Q: What is the actual computer vision here?
**A**: Real OpenCV operations on real PCB images: template comparison (`cv2.absdiff`), adaptive thresholding, contour detection, morphological analysis, feature extraction. The defect score is computed from actual image statistics. The decision is deterministic based on those features. This is deterministic computer vision, not a trained neural network — and we are explicit about that distinction.

### Q: What is simulated?
**A**: The camera (loads images from a dataset), the robot (position interpolation with timing delays), the sensors (scenario-defined values with added noise), and the lighting (image transforms). Every simulated component is clearly labeled `[SIMULATED]` or `[VIRTUAL]` in the UI and data.

### Q: How would hardware replace the simulation?
**A**: Every virtual component implements an abstract interface (`CameraInterface`, `RobotInterface`, etc.). To connect real hardware, you implement the same interface against a camera SDK, serial robot controller, or ESP32 sensor module. The inspection logic does not change. A single config flag switches modes.

### Q: How is the defect score calculated?
**A**: The OpenCV pipeline computes the pixel-wise difference between the test image and a defect-free template. From the resulting anomaly map, we extract features: anomaly magnitude, anomaly area ratio, edge discontinuity, and contrast. These features are combined with fixed weights into a defect score from 0.0 (clean) to 1.0 (defective). It is a heuristic score, not a calibrated probability — and we say so explicitly.

### Q: Why should we trust the result?
**A**: Because every step is auditable. The explanation panel shows: which features contributed, what score each observation produced, how the evidence was fused, and which threshold triggered the decision. You can trace the decision back to specific pixels in the image.

### Q: What happens when evidence conflicts?
**A**: The weighted fusion method handles this naturally. If one observation scores 0.3 (looks clean) and another scores 0.8 (looks defective), the fused score will be intermediate (~0.55), which may trigger a forced decision at the final evaluation. The agreement metric (displayed in the explanation) explicitly flags when sources disagree.

### Q: Is this just a scripted demo?
**A**: No. The OpenCV pipeline runs real image analysis on real PCB images. Different images produce different defect scores — you can see the feature values change. The RECHECK decision is driven by the actual score falling in the ambiguous zone, not by a hardcoded flag. Switching scenarios produces genuinely different outcomes (PASS, FAIL, or RECHECK) based on the actual image content.
