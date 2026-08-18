# AURA — API Contract (Revised)

## 1. Overview

**5 REST endpoints + 1 WebSocket.** That's the entire API.

Base URL: `http://localhost:8000`

---

## 2. REST Endpoints

### `GET /api/system/status`

System health check.

**Response 200:**
```json
{
    "status": "ready",
    "hardware_mode": "simulation",
    "active_inspection": null,
    "scenarios_loaded": 3
}
```

---

### `GET /api/scenarios`

List available scenarios.

**Response 200:**
```json
{
    "scenarios": [
        {
            "id": "clean_board",
            "name": "Clean Board — PASS Expected",
            "description": "Defect-free PCB. Demonstrates confident PASS."
        },
        {
            "id": "obvious_defect",
            "name": "Obvious Open Circuit — FAIL Expected",
            "description": "Large visible defect. Demonstrates confident FAIL."
        },
        {
            "id": "ambiguous_recheck",
            "name": "Subtle Solder Bridge — RECHECK Demo",
            "description": "Barely visible defect. RECHECK → reposition → fuse → FAIL."
        }
    ]
}
```

---

### `POST /api/inspection/start`

Start an inspection. Only one inspection can run at a time.

**Request:**
```json
{
    "scenario_id": "ambiguous_recheck"
}
```

**Response 201:**
```json
{
    "inspection_id": "insp_a7f3",
    "scenario_id": "ambiguous_recheck",
    "status": "POSITIONING",
    "message": "Inspection started"
}
```

**Errors:**
| Status | Condition |
|---|---|
| 400 | Missing `scenario_id` |
| 404 | Scenario not found |
| 409 | Another inspection already running |

---

### `GET /api/inspection/{inspection_id}`

Get complete inspection state (during or after).

**Response 200:**
```json
{
    "inspection_id": "insp_a7f3",
    "scenario_id": "ambiguous_recheck",
    "scenario_name": "Subtle Solder Bridge — RECHECK Demo",
    "status": "COMPLETE",

    "observations": [
        {
            "observation_number": 1,
            "camera_position": {"x": 150, "y": 100, "z": 300, "angle": 0, "zoom": 1.0},
            "lighting_mode": "direct",
            "defect_score": 0.48,
            "defects_found": 1,
            "features": {
                "anomaly_score": 0.40,
                "anomaly_area_ratio": 0.01,
                "edge_discontinuity": 0.35,
                "contrast_ratio": 0.30,
                "defect_count": 1
            },
            "image_base64": "data:image/png;base64,...",
            "processing_time_ms": 87
        },
        {
            "observation_number": 2,
            "camera_position": {"x": 160, "y": 105, "z": 150, "angle": 15, "zoom": 2.0},
            "lighting_mode": "angled",
            "defect_score": 0.78,
            "defects_found": 1,
            "features": {
                "anomaly_score": 0.70,
                "anomaly_area_ratio": 0.03,
                "edge_discontinuity": 0.55,
                "contrast_ratio": 0.60,
                "defect_count": 1
            },
            "image_base64": "data:image/png;base64,...",
            "processing_time_ms": 92
        }
    ],

    "evidence": [
        {"source": "visual_obs_1", "defect_score": 0.48, "reliability": 1.0, "is_simulated": false},
        {"source": "visual_obs_2", "defect_score": 0.78, "reliability": 1.0, "is_simulated": false}
    ],

    "fusion": {
        "fused_defect_score": 0.63,
        "decision_confidence": 0.52,
        "evidence_count": 2,
        "agreement": 0.70,
        "method": "reliability_weighted_average"
    },

    "decision": {
        "result": "FAIL",
        "defect_score": 0.63,
        "decision_confidence": 0.52,
        "threshold_used": "fused_fail_threshold (0.60)",
        "observation_count": 2,
        "recheck_count": 1,
        "reasoning": [
            "Observation 1: defect score 0.48 — ambiguous (0.30 ≤ score ≤ 0.70)",
            "RECHECK triggered: repositioned to close-range angled view",
            "Observation 2: defect score 0.78 — clearer with enhanced contrast",
            "Evidence fusion: weighted score 0.63 exceeds FAIL threshold 0.60",
            "Decision: FAIL — suspected short circuit confirmed after recheck"
        ]
    },

    "timeline": [
        {"time": "00:00.0", "state": "POSITIONING", "description": "Robot moving to primary position"},
        {"time": "00:02.0", "state": "ACQUIRING", "description": "Capturing image"},
        {"time": "00:02.8", "state": "ANALYZING", "description": "OpenCV analysis running"},
        {"time": "00:03.0", "state": "EVALUATING", "description": "Defect score: 0.48 (ambiguous)"},
        {"time": "00:03.1", "state": "RECHECKING", "description": "RECHECK — repositioning for second view"},
        {"time": "00:03.2", "state": "POSITIONING", "description": "Robot moving to recheck position"},
        {"time": "00:05.2", "state": "ACQUIRING", "description": "Capturing recheck image"},
        {"time": "00:06.0", "state": "ANALYZING", "description": "OpenCV analysis running"},
        {"time": "00:06.2", "state": "FUSING", "description": "Combining evidence from 2 observations"},
        {"time": "00:06.3", "state": "EVALUATING", "description": "Fused score: 0.63 → FAIL"},
        {"time": "00:06.4", "state": "DECIDING", "description": "Decision: FAIL"},
        {"time": "00:06.5", "state": "ACTING", "description": "Robot moving to reject bin"},
        {"time": "00:08.0", "state": "COMPLETE", "description": "Inspection complete"}
    ],

    "started_at": "2026-08-18T14:30:00.000Z",
    "completed_at": "2026-08-18T14:30:08.000Z",
    "duration_ms": 8000
}
```

---

### `POST /api/system/reset`

Reset system to IDLE. Aborts any running inspection.

**Response 200:**
```json
{
    "status": "IDLE",
    "message": "System reset"
}
```

---

## 3. WebSocket

### Connection

`ws://localhost:8000/ws`

Single connection for all events. No authentication.

### Event Envelope

```json
{
    "type": "<event_type>",
    "inspection_id": "<id>",
    "timestamp": "<ISO 8601>",
    "data": { ... }
}
```

### Event Types

| Type | When | Key Data |
|---|---|---|
| `state_change` | Every FSM transition | `from_state`, `to_state`, `description` |
| `robot_position` | During robot motion | `x`, `y`, `z`, `angle`, `progress` |
| `image_acquired` | Image captured | `observation_number`, `image_base64` |
| `analysis_complete` | OpenCV done | `defect_score`, `defects`, `features`, `processing_time_ms` |
| `score_update` | Score evaluated | `defect_score`, `decision_confidence`, `recommendation` |
| `recheck_triggered` | RECHECK entered | `reason`, `new_position`, `new_lighting` |
| `evidence_fused` | Fusion complete | `fused_defect_score`, `decision_confidence`, `agreement` |
| `decision_made` | Final decision | `result`, `defect_score`, `reasoning` |
| `inspection_complete` | All done | `result`, `duration_ms`, `observation_count` |
| `error` | Error occurred | `message`, `recoverable` |

### Client → Server

Only supported message:

```json
{"type": "ping"}
→ {"type": "pong", "timestamp": "..."}
```

---

## 4. Error Format

```json
{
    "error": true,
    "message": "Scenario 'xyz' not found",
    "detail": "Available: clean_board, obvious_defect, ambiguous_recheck"
}
```

---

## 5. CORS

Fully permissive (demo only):

```python
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
```

Frontend is served from the same origin, so CORS is technically unnecessary. Enabled as safety net.
