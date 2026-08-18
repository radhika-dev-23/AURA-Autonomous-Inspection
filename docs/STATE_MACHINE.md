# AURA — State Machine (Revised)

## 1. Overview

The inspection lifecycle is a **deterministic finite state machine (FSM)**. Every state change is logged, broadcast via WebSocket, and visible in the frontend timeline. The FSM is implemented as a simple transition table — no framework, no library.

---

## 2. State Diagram

```
              ┌──────────┐
              │   IDLE   │◄──────────────────────────────────┐
              └────┬─────┘                                    │
                   │ start_inspection(scenario_id)            │
                   ▼                                          │
            ┌─────────────┐                                   │
            │ POSITIONING │◄───────────────┐                  │
            └──────┬──────┘                │                  │
                   │ robot_arrived         │                  │
                   ▼                       │                  │
             ┌───────────┐                 │                  │
             │ ACQUIRING │                 │                  │
             └─────┬─────┘                 │                  │
                   │ image_captured        │                  │
                   ▼                       │                  │
             ┌───────────┐                 │                  │
             │ ANALYZING │                 │                  │
             └─────┬─────┘                 │                  │
                   │ analysis_done         │                  │
                   ▼                       │                  │
            ┌─────────────┐                │                  │
            │ EVALUATING  │                │                  │
            └──────┬──────┘                │                  │
                   │                       │                  │
        ┌──────────┼──────────┐            │                  │
    score clear    │     score ambiguous   │                  │
    (< 0.30 or    │     (0.30–0.70)       │                  │
     > 0.70)      │     AND rechecks      │                  │
        │         │     < MAX             │                  │
        │         │          │            │                  │
        │     max rechecks   │            │                  │
        │     reached        │            │                  │
        │         │          ▼            │                  │
        │         │   ┌────────────┐      │                  │
        │         │   │ RECHECKING │      │                  │
        │         │   └─────┬──────┘      │                  │
        │         │         │ plan ready  │                  │
        │         │         └─────────────┘                  │
        │         │         (→ POSITIONING with              │
        │         │            new viewpoint)                 │
        │         │                                          │
        │         │  (after recheck:                         │
        │         │   ANALYZING → FUSING → EVALUATING)       │
        │         │                                          │
        │         │   ┌────────┐                             │
        │         │   │ FUSING │  (only after recheck obs)   │
        │         │   └───┬────┘                             │
        │         │       │                                  │
        └─────────┼───────┘                                  │
                  │                                          │
                  ▼                                          │
            ┌───────────┐                                    │
            │ DECIDING  │                                    │
            └─────┬─────┘                                    │
                  │                                          │
                  ▼                                          │
            ┌──────────┐                                     │
            │ ACTING   │                                     │
            └────┬─────┘                                     │
                 │                                           │
                 ▼                                           │
            ┌───────────┐                                    │
            │ COMPLETE  │────────────────────────────────────┘
            └───────────┘        reset

            ┌──────────┐
            │  ERROR   │─────── reset ──→ IDLE
            └──────────┘
```

---

## 3. States

| State | Description | Simulated Duration | WebSocket Event |
|---|---|---|---|
| `IDLE` | Ready, no inspection running | — | — |
| `POSITIONING` | Robot moving to inspection position | ~2s | `state_change`, `robot_position` |
| `ACQUIRING` | Camera capturing image | ~0.8s | `state_change`, `image_acquired` |
| `ANALYZING` | OpenCV pipeline processing image | Real: 50–200ms | `state_change`, `analysis_complete` |
| `EVALUATING` | Defect score vs thresholds | Instant | `score_update` |
| `RECHECKING` | Planning new viewpoint for re-inspection | Instant | `recheck_triggered` |
| `FUSING` | Combining evidence from multiple observations | Instant | `evidence_fused` |
| `DECIDING` | Producing final PASS/FAIL | Instant | `decision_made` |
| `ACTING` | Robot performing pass/reject action | ~1.5s | `state_change`, `action_performed` |
| `COMPLETE` | Inspection finished, timeline finalized | — | `inspection_complete` |
| `ERROR` | Recoverable error | — | `error` |

---

## 4. Transition Table

### 4.1 Primary Path (Score Is Clear on First Observation)

| From | To | Trigger | Guard |
|---|---|---|---|
| `IDLE` | `POSITIONING` | `start_inspection(scenario_id)` | scenario exists, no active inspection |
| `POSITIONING` | `ACQUIRING` | robot arrived at target | — |
| `ACQUIRING` | `ANALYZING` | image captured | image is valid |
| `ANALYZING` | `EVALUATING` | analysis complete | — |
| `EVALUATING` | `DECIDING` | score is clear | `score < 0.30` OR `score > 0.70` |
| `DECIDING` | `ACTING` | decision made | — |
| `ACTING` | `COMPLETE` | action complete | — |
| `COMPLETE` | `IDLE` | reset | — |

### 4.2 RECHECK Path (Score Is Ambiguous)

| From | To | Trigger | Guard |
|---|---|---|---|
| `EVALUATING` | `RECHECKING` | score ambiguous | `0.30 ≤ score ≤ 0.70` AND `recheck_count < MAX_RECHECKS` |
| `RECHECKING` | `POSITIONING` | recheck plan ready | new viewpoint selected |
| (continues through POSITIONING → ACQUIRING → ANALYZING) | | | |
| `ANALYZING` | `FUSING` | analysis complete | `recheck_count > 0` (i.e., this is a recheck observation) |
| `FUSING` | `EVALUATING` | fusion complete | — |

### 4.3 Forced Decision (Max Rechecks Reached)

| From | To | Trigger | Guard |
|---|---|---|---|
| `EVALUATING` | `DECIDING` | max rechecks | `recheck_count >= MAX_RECHECKS` |

Decision rule when forced: `fused_score > 0.50 → FAIL, else → PASS`

### 4.4 Error Handling

| From | To | Trigger |
|---|---|---|
| Any | `ERROR` | unhandled exception |
| `ERROR` | `IDLE` | reset |

---

## 5. RECHECK Flow — Detailed

This is the central feature. Here is exactly what happens:

```
OBSERVATION 1 (Standard View):
  Position:  (150, 100, 300mm) — top-down
  Lighting:  Direct, standard intensity
  Image:     Full PCB test image from scenario
  Analysis:  Template diff → features → defect_score = 0.48
  Evaluate:  0.30 ≤ 0.48 ≤ 0.70 → AMBIGUOUS → RECHECK

  ── RECHECK TRIGGERED ──

  Why: "Defect score 0.48 is in the ambiguous zone (0.30–0.70).
        AURA cannot confidently PASS or FAIL.
        Requesting additional evidence."

  Plan: Move closer, angle the view, change lighting to reveal surface detail.

OBSERVATION 2 (Recheck View):
  Position:  (160, 105, 150mm) — closer, angled
  Lighting:  Angled (45°), high intensity
  Image:     Different image OR cropped/transformed version of same image
  Analysis:  Template diff → features → defect_score = 0.78
  
  The second observation produces GENUINELY DIFFERENT evidence because:
  - Different viewpoint reveals surface topology
  - Different lighting creates different shadows/highlights
  - Zoomed view provides more detail on the suspect region
  - The image is visibly different in the frontend

EVIDENCE FUSION:
  Observation 1: defect_score = 0.48, reliability = 1.0
  Observation 2: defect_score = 0.78, reliability = 1.0
  (Optional P1) Thermal [SIMULATED]: defect_score = 0.65, reliability = 0.5

  Fused score = weighted average = 0.63 (without sensors) or 0.65 (with)

FINAL EVALUATION:
  Post-fusion threshold: FAIL > 0.60
  Fused score 0.63 > 0.60 → FAIL

DECISION:
  Result: FAIL
  Reasoning: [
    "Observation 1: defect score 0.48 (ambiguous — RECHECK triggered)",
    "Observation 2: defect score 0.78 (angled view confirms defect)",
    "Evidence fusion: weighted score 0.63 (exceeds FAIL threshold 0.60)",
    "Decision: FAIL — suspected short circuit confirmed after recheck"
  ]
```

---

## 6. Configuration

```python
# Defect score thresholds (single observation)
PASS_THRESHOLD = 0.30      # Below → confident PASS
FAIL_THRESHOLD = 0.70      # Above → confident FAIL
# Between → RECHECK

# Post-fusion thresholds (tighter — more evidence available)
FUSED_PASS_THRESHOLD = 0.35
FUSED_FAIL_THRESHOLD = 0.60

# Recheck limit
MAX_RECHECKS = 2

# Timing (milliseconds, divided by SIMULATION_SPEED)
ROBOT_MOVE_DURATION   = 2000
CAMERA_CAPTURE_DELAY  = 800
ROBOT_ACTION_DURATION = 1500
SIMULATION_SPEED      = 1.0
```

---

## 7. Implementation Strategy

The FSM is a **dictionary-based transition table**:

```python
transitions = {
    (State.IDLE, Trigger.START):            State.POSITIONING,
    (State.POSITIONING, Trigger.ARRIVED):   State.ACQUIRING,
    (State.ACQUIRING, Trigger.CAPTURED):    State.ANALYZING,
    (State.ANALYZING, Trigger.ANALYZED):    State.EVALUATING,  # or FUSING
    (State.EVALUATING, Trigger.CLEAR):      State.DECIDING,
    (State.EVALUATING, Trigger.AMBIGUOUS):  State.RECHECKING,
    (State.EVALUATING, Trigger.MAX_RECHECK):State.DECIDING,
    (State.RECHECKING, Trigger.PLANNED):    State.POSITIONING,
    (State.FUSING, Trigger.FUSED):          State.EVALUATING,
    (State.DECIDING, Trigger.DECIDED):      State.ACTING,
    (State.ACTING, Trigger.ACTED):          State.COMPLETE,
    (State.COMPLETE, Trigger.RESET):        State.IDLE,
    (State.ERROR, Trigger.RESET):           State.IDLE,
}
```

No state machine library needed. This is ~30 lines of code.

Every transition calls `ws_manager.broadcast()` with the new state and relevant data.

---

## 8. Context Object

```python
@dataclass
class InspectionContext:
    inspection_id: str
    scenario_id: str
    current_state: State
    observations: List[Observation]      # All captured observations
    evidence_items: List[EvidenceItem]    # All evidence for fusion
    recheck_count: int = 0
    fused_score: Optional[float] = None
    decision: Optional[Decision] = None
    timeline: List[TimelineEvent] = field(default_factory=list)
    started_at: datetime = field(default_factory=datetime.utcnow)
```

One inspection = one context. Single-threaded within the async event loop. No concurrency issues.
