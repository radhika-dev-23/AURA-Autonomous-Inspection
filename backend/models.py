from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Any
from datetime import datetime

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

@dataclass
class BBox:
    x: int
    y: int
    w: int
    h: int

@dataclass
class DetectedDefect:
    defect_type: str
    bbox: BBox
    severity: str
    area_pixels: int
    mean_intensity: float
    description: str

@dataclass
class FeatureVector:
    anomaly_score: float
    anomaly_area_ratio: float
    max_anomaly_intensity: float
    edge_discontinuity: float
    contrast_ratio: float
    defect_count: int
    sharpness: float

@dataclass
class AnalysisResult:
    defects: List[DetectedDefect]
    defect_score: float
    features: FeatureVector
    heatmap_base64: Optional[str]
    processing_time_ms: float
    method: str

@dataclass
class CameraPosition:
    x: float
    y: float
    z: float
    angle_deg: float
    zoom: float
    label: str

@dataclass
class Observation:
    id: str
    observation_number: int
    camera_position: CameraPosition
    lighting_mode: str
    image_path: str
    image_base64: Optional[str]
    analysis: Optional[AnalysisResult]
    timestamp: datetime

@dataclass
class EvidenceItem:
    id: str
    source: str
    defect_score: float
    reliability: float
    is_simulated: bool
    observation_id: Optional[str]
    metadata: Dict[str, Any]
    timestamp: datetime

@dataclass
class FusedResult:
    fused_defect_score: float
    decision_confidence: float
    evidence_count: int
    agreement: float
    contributions: List[Dict]
    method: str

@dataclass
class Decision:
    result: str
    defect_score: float
    decision_confidence: float
    threshold_used: str
    observation_count: int
    recheck_count: int
    reasoning: List[str]
    defect_summary: List[Dict]
    timestamp: datetime

@dataclass
class TimelineEvent:
    timestamp: datetime
    state: str
    event_type: str
    description: str
    data: Optional[Dict] = None

@dataclass
class Inspection:
    id: str
    scenario_id: str
    status: State
    observations: List[Observation]
    evidence_items: List[EvidenceItem]
    fused_score: Optional[float]
    decision: Optional[Decision]
    timeline: List[TimelineEvent]
    recheck_count: int
    started_at: datetime
    completed_at: Optional[datetime]

@dataclass
class Scenario:
    id: str
    name: str
    description: str
    expected_result: str
    expected_path: str
    template_image: str
    test_images: List[str]
    defect_annotations: List[Dict]
    inspection_positions: List[CameraPosition]
    lighting_modes: List[str]
    sensor_overrides: Dict[str, float]
