# AURA — Data Model (Revised)

## 1. Design Principles

- All models are Python `dataclasses` (backend logic) or Pydantic `BaseModel` (API serialization)
- **Defect score** and **decision confidence** are clearly separate concepts
- Simulated values are explicitly tagged
- No fake probabilities — heuristic scores are called scores
- JSON serialization for API responses and WebSocket messages
- In-memory storage by default; SQLite is optional (P1)

---

## 2. Core Domain Objects

### 2.1 Inspection

```python
@dataclass
class Inspection:
    id: str                                  # "insp_<short_uuid>"
    scenario_id: str
    status: State                            # Current FSM state
    observations: List[Observation]
    evidence_items: List[EvidenceItem]
    fused_score: Optional[float]             # Fused defect score after fusion
    decision: Optional[Decision]
    timeline: List[TimelineEvent]
    recheck_count: int
    started_at: datetime
    completed_at: Optional[datetime]
```

### 2.2 Observation

```python
@dataclass
class Observation:
    id: str                                  # "obs_1", "obs_2"
    observation_number: int                  # 1-indexed
    camera_position: CameraPosition
    lighting_mode: str                       # "direct", "angled"
    image_path: str                          # Source image path
    image_base64: Optional[str]              # For WebSocket/API transmission
    analysis: Optional[AnalysisResult]
    timestamp: datetime
```

### 2.3 AnalysisResult

Output of the OpenCV pipeline for a single image.

```python
@dataclass
class AnalysisResult:
    defects: List[DetectedDefect]            # Localized defect regions
    defect_score: float                      # 0.0–1.0 heuristic (NOT a probability)
    features: FeatureVector                  # Raw feature values
    heatmap_base64: Optional[str]            # Anomaly heatmap (P1)
    processing_time_ms: float                # Actual wall-clock time
    method: str                              # "template_diff"
```

### 2.4 DetectedDefect

```python
@dataclass
class DetectedDefect:
    defect_type: str                         # "short_circuit", "open_circuit", etc.
    bbox: BBox                               # Bounding box in image coordinates
    severity: str                            # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    area_pixels: int
    mean_intensity: float                    # Mean anomaly intensity in region
    description: str                         # Human-readable
```

### 2.5 BBox

```python
@dataclass
class BBox:
    x: int                                   # Top-left x
    y: int                                   # Top-left y
    w: int                                   # Width
    h: int                                   # Height
```

---

## 3. Scoring & Decision

### 3.1 FeatureVector

Raw features extracted by OpenCV. Each is a real, computed value.

```python
@dataclass
class FeatureVector:
    anomaly_score: float                     # Mean template-diff magnitude (0–1)
    anomaly_area_ratio: float                # Fraction of image with anomalies (0–1)
    max_anomaly_intensity: float             # Peak diff value (0–1)
    edge_discontinuity: float                # Broken edges score (0–1)
    contrast_ratio: float                    # Local contrast around anomalies (0–1)
    defect_count: int                        # Number of anomalous contour regions
    sharpness: float                         # Image quality (Laplacian variance, 0–1)
```

### 3.2 EvidenceItem

A single piece of scored evidence. May come from visual analysis or simulated sensors.

```python
@dataclass
class EvidenceItem:
    id: str                                  # "evi_1"
    source: str                              # "visual_obs_1", "visual_obs_2",
                                             # "thermal_sim", "electrical_sim"
    defect_score: float                      # 0.0 (clean) to 1.0 (defective)
    reliability: float                       # 0.0 to 1.0 — how much we trust this source
    is_simulated: bool                       # True for virtual sensors
    observation_id: Optional[str]            # Link to parent observation (if visual)
    metadata: Dict[str, Any]                 # Source-specific details
    timestamp: datetime
```

> **Note**: `defect_score` is a heuristic measure, not a calibrated probability.
> `reliability` is a fixed weight assigned to each source type, not learned.

### 3.3 FusedResult

```python
@dataclass
class FusedResult:
    fused_defect_score: float                # Weighted average of all evidence scores
    decision_confidence: float               # Clarity metric (0–1)
    evidence_count: int
    agreement: float                         # Do sources agree? (0–1)
    contributions: List[Dict]                # Per-evidence breakdown
    method: str                              # "weighted_average"
```

### 3.4 Decision

```python
@dataclass
class Decision:
    result: str                              # "PASS" or "FAIL"
    defect_score: float                      # Score that drove the decision
    decision_confidence: float               # How clear-cut (informational)
    threshold_used: str                      # Which threshold was applied
    observation_count: int
    recheck_count: int
    reasoning: List[str]                     # Ordered reasoning chain
    defect_summary: List[Dict]               # Summary of detected defects
    timestamp: datetime
```

---

## 4. Enumerations

```python
class State(str, Enum):
    IDLE          = "IDLE"
    POSITIONING   = "POSITIONING"
    ACQUIRING     = "ACQUIRING"
    ANALYZING     = "ANALYZING"
    EVALUATING    = "EVALUATING"
    RECHECKING    = "RECHECKING"
    FUSING        = "FUSING"
    DECIDING      = "DECIDING"
    ACTING        = "ACTING"
    COMPLETE      = "COMPLETE"
    ERROR         = "ERROR"
```

---

## 5. Configuration & Simulation Objects

### 5.1 CameraPosition

```python
@dataclass
class CameraPosition:
    x: float                                 # mm
    y: float                                 # mm
    z: float                                 # mm (height above PCB)
    angle_deg: float                         # 0 = top-down, 30 = angled
    zoom: float                              # 1.0 = normal
    label: str                               # "primary", "recheck_close"
```

### 5.2 TimelineEvent

```python
@dataclass
class TimelineEvent:
    timestamp: datetime
    state: str                               # FSM state at this moment
    event_type: str                          # "state_change", "recheck", "decision"
    description: str                         # Human-readable
    data: Optional[Dict] = None              # Event-specific payload
```

---

## 6. Scenario Definition

```python
@dataclass
class Scenario:
    id: str                                  # "clean_board"
    name: str                                # "Clean Board — PASS Expected"
    description: str
    expected_result: str                     # "PASS", "FAIL"
    expected_path: str                       # "direct", "recheck"
    template_image: str                      # Path to defect-free reference
    test_images: List[str]                   # Paths: [obs_1_image, obs_2_image, ...]
    defect_annotations: List[Dict]           # Ground truth (for evaluation)
    inspection_positions: List[CameraPosition]
    lighting_modes: List[str]               # ["direct", "angled"]
    sensor_overrides: Dict[str, float]      # Simulated sensor base values
```

---

## 7. Storage

### Default: In-Memory Dict

```python
inspection_store: Dict[str, Inspection] = {}
```

### Optional (P1): SQLite

```sql
CREATE TABLE IF NOT EXISTS inspections (
    id              TEXT PRIMARY KEY,
    scenario_id     TEXT NOT NULL,
    result          TEXT,
    defect_score    REAL,
    confidence      REAL,
    observation_count INTEGER DEFAULT 0,
    recheck_count   INTEGER DEFAULT 0,
    duration_ms     INTEGER,
    start_time      TEXT NOT NULL,
    end_time        TEXT,
    full_state_json TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);
```

SQLite is **not on the critical path**. If it causes issues, drop it entirely.

---

## 8. Object Relationships

```
Scenario
    │
    ▼
Inspection
    ├── Observation (1..N)
    │       ├── CameraPosition
    │       └── AnalysisResult
    │               ├── DetectedDefect (0..N)
    │               │       └── BBox
    │               └── FeatureVector
    ├── EvidenceItem (1..N)
    │       └── is_simulated flag
    ├── FusedResult (0..1)
    ├── Decision (0..1)
    └── TimelineEvent (1..N)
```
