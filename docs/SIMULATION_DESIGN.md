# AURA — Simulation & Digital Twin Design (Revised)

## 1. Overview

The simulation layer is a **software digital twin** of a physical inspection cell. Every physical component has a virtual counterpart implementing the same abstract interface. All simulated components are **clearly labeled** — the system never pretends a virtual reading is a physical measurement.

---

## 2. Hardware Abstraction Layer (HAL)

```python
from abc import ABC, abstractmethod
import numpy as np
from typing import Dict, Any

class CameraInterface(ABC):
    @abstractmethod
    async def capture(self, position: CameraPosition) -> np.ndarray:
        """Capture an image. Returns HxWx3 numpy array."""
        ...

class RobotInterface(ABC):
    @abstractmethod
    async def move_to(self, position: CameraPosition) -> Dict[str, Any]:
        """Move to position. Returns final pose + timing info."""
        ...

    @abstractmethod
    async def perform_action(self, action: str) -> bool:
        """Execute named action: 'pass_lane' or 'reject_bin'."""
        ...

    @abstractmethod
    def get_position(self) -> Dict[str, float]:
        """Return current position as dict."""
        ...

class SensorInterface(ABC):
    @abstractmethod
    async def read_all(self) -> Dict[str, Any]:
        """Read all sensors. All values MUST include 'is_simulated' flag."""
        ...

class LightingInterface(ABC):
    @abstractmethod
    async def set_mode(self, mode: str, intensity: float) -> bool:
        """Set lighting mode. Returns success."""
        ...
```

Switching from simulation to hardware = implementing these 4 interfaces against real devices. The inspection engine never knows the difference.

---

## 3. Virtual Camera

### 3.1 Responsibility

Return PCB images from the dataset when the inspection engine requests a capture. Simulate different viewpoints by selecting different images or applying transforms.

### 3.2 Implementation

```python
class VirtualCamera(CameraInterface):
    """
    [VIRTUAL CAMERA] — loads pre-existing images, not live capture.
    
    Different observations produce different images via:
    1. Different image files (if scenario provides multiple)
    2. Image transforms (crop, contrast, perspective — if only one image)
    """

    def __init__(self, scenario_manager):
        self.scenario_manager = scenario_manager
        self.current_lighting_mode = "direct"

    async def capture(self, position: CameraPosition) -> np.ndarray:
        scenario = self.scenario_manager.current
        obs_num = self.scenario_manager.observation_number

        # Load base image for this observation
        if obs_num < len(scenario.test_images):
            image = cv2.imread(scenario.test_images[obs_num])
        else:
            # Generate recheck view from existing image
            base = cv2.imread(scenario.test_images[0])
            defect_bbox = scenario.defect_annotations[0]["bbox"] if scenario.defect_annotations else None
            image = self._create_recheck_view(base, defect_bbox, position)

        # Simulate capture delay
        await asyncio.sleep(CAMERA_CAPTURE_DELAY / 1000.0 / SIMULATION_SPEED)

        return image

    def _create_recheck_view(self, image, defect_bbox, position):
        """
        Create a genuinely different image for recheck.
        Simulates: closer viewpoint, enhanced contrast, histogram equalization.
        """
        if defect_bbox and position.zoom > 1.0:
            # Crop around defect region
            pad = 80
            x, y, w, h = defect_bbox["x"], defect_bbox["y"], defect_bbox["w"], defect_bbox["h"]
            x1, y1 = max(0, x - pad), max(0, y - pad)
            x2 = min(image.shape[1], x + w + pad)
            y2 = min(image.shape[0], y + h + pad)
            image = image[y1:y2, x1:x2]
            image = cv2.resize(image, (640, 640))

        # Enhance contrast (simulates angled lighting)
        if self.current_lighting_mode == "angled":
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            lab[:, :, 0] = cv2.equalizeHist(lab[:, :, 0])
            image = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            image = cv2.convertScaleAbs(image, alpha=1.3, beta=10)

        return image
```

### 3.3 Future Hardware Replacement

```python
class USBCamera(CameraInterface):
    def __init__(self, device_id=0):
        self.cap = cv2.VideoCapture(device_id)

    async def capture(self, position: CameraPosition) -> np.ndarray:
        ret, frame = self.cap.read()
        if not ret:
            raise HardwareError("Camera capture failed")
        return frame
```

---

## 4. Virtual Robot

### 4.1 Responsibility

Track position, simulate motion with timing delays, and provide position data for frontend animation.

### 4.2 Implementation

```python
class VirtualRobot(RobotInterface):
    """
    [VIRTUAL ROBOT] — position state + time delays, not physical motion.
    """

    def __init__(self):
        self.position = {"x": 0, "y": 0, "z": 400, "angle": 0}
        self.is_moving = False

    async def move_to(self, target: CameraPosition) -> Dict[str, Any]:
        start = self.position.copy()
        target_dict = {"x": target.x, "y": target.y, "z": target.z, "angle": target.angle_deg}

        # Calculate distance-based duration
        dist = math.sqrt(sum((target_dict[k] - start[k])**2 for k in ["x", "y", "z"]))
        duration_ms = max(dist / 0.2, 500)  # 200mm/s, min 500ms

        self.is_moving = True

        # Simulate motion in steps for frontend animation
        steps = 20
        for i in range(steps + 1):
            t = i / steps
            self.position = {
                k: start[k] + (target_dict[k] - start[k]) * t
                for k in ["x", "y", "z", "angle"]
            }
            await asyncio.sleep((duration_ms / steps) / 1000.0 / SIMULATION_SPEED)

        self.is_moving = False
        return {"position": self.position, "duration_ms": duration_ms}

    async def perform_action(self, action: str) -> bool:
        if action == "pass_lane":
            await self._animate_to({"x": 300, "y": 0, "z": 200, "angle": 0})
        elif action == "reject_bin":
            await self._animate_to({"x": -300, "y": 0, "z": 200, "angle": 0})
        return True

    def get_position(self) -> Dict[str, float]:
        return self.position.copy()
```

### 4.3 Inspection Positions

```python
POSITIONS = {
    "home":           CameraPosition(x=0,   y=0,   z=400, angle_deg=0,  zoom=1.0, label="home"),
    "primary":        CameraPosition(x=150, y=100, z=300, angle_deg=0,  zoom=1.0, label="primary"),
    "recheck_close":  CameraPosition(x=160, y=105, z=150, angle_deg=15, zoom=2.0, label="recheck_close"),
}
```

---

## 5. Virtual Sensors — Explicitly SIMULATED

### 5.1 Critical Rule

> **Every virtual sensor reading MUST include `is_simulated: True`.**
> The frontend MUST display `[SIMULATED]` next to any virtual sensor value.
> Simulated readings MUST NOT be presented as physical measurements.

### 5.2 Implementation

```python
class VirtualSensors(SensorInterface):
    """
    [SIMULATED SENSORS] — values derived from scenario config + noise.
    These are NOT physical measurements.
    """

    def __init__(self, scenario_manager):
        self.scenario_manager = scenario_manager

    async def read_all(self) -> Dict[str, Any]:
        overrides = self.scenario_manager.current.sensor_overrides

        return {
            "thermal": {
                "value": overrides.get("thermal_anomaly", 0.0) + random.gauss(0, 0.03),
                "unit": "anomaly_score",
                "is_simulated": True,       # ← ALWAYS TRUE for virtual sensors
                "label": "[SIMULATED] Thermal anomaly indicator"
            },
            "electrical": {
                "value": overrides.get("continuity", 1.0) + random.gauss(0, 0.02),
                "unit": "continuity_score",
                "is_simulated": True,       # ← ALWAYS TRUE
                "label": "[SIMULATED] Electrical continuity"
            }
        }
```

### 5.3 Sensor → Evidence Conversion

```python
def sensors_to_evidence(readings: Dict) -> List[EvidenceItem]:
    """
    Convert simulated sensor readings to evidence items.
    Note: reliability is intentionally low (0.5) for simulated sources.
    """
    evidence = []

    if "thermal" in readings:
        thermal = readings["thermal"]
        evidence.append(EvidenceItem(
            source="thermal_sim",
            defect_score=max(0, min(1, thermal["value"])),
            reliability=0.5,             # Lower weight — it's simulated
            is_simulated=True,           # Explicitly flagged
        ))

    if "electrical" in readings:
        electrical = readings["electrical"]
        # Low continuity → high defect score
        evidence.append(EvidenceItem(
            source="electrical_sim",
            defect_score=max(0, min(1, 1.0 - electrical["value"])),
            reliability=0.5,
            is_simulated=True,
        ))

    return evidence
```

---

## 6. Virtual Lighting

```python
class VirtualLighting(LightingInterface):
    """
    [VIRTUAL LIGHTING] — state tracking only.
    Actual effect is applied by VirtualCamera during capture.
    """

    def __init__(self):
        self.mode = "direct"
        self.intensity = 0.8

    async def set_mode(self, mode: str, intensity: float) -> bool:
        self.mode = mode
        self.intensity = intensity
        return True
```

Lighting modes: `"direct"` (standard), `"angled"` (side illumination for recheck).

---

## 7. Scenario Engine

### 7.1 Scenario JSON Format

```json
{
    "id": "ambiguous_recheck",
    "name": "Subtle Solder Bridge — RECHECK Demo",
    "description": "Barely visible bridge between traces. First observation is uncertain. RECHECK with different viewpoint confirms the defect.",
    "expected_result": "FAIL",
    "expected_path": "recheck",

    "template_image": "data/images/templates/board_01_clean.png",
    "test_images": [
        "data/images/test/board_01_subtle_defect.png",
        "data/images/test/board_01_subtle_defect_zoomed.png"
    ],

    "defect_annotations": [
        {
            "type": "short_circuit",
            "bbox": {"x": 280, "y": 310, "w": 45, "h": 20},
            "severity": "HIGH"
        }
    ],

    "inspection_positions": [
        {"label": "primary", "x": 150, "y": 100, "z": 300, "angle_deg": 0, "zoom": 1.0},
        {"label": "recheck_close", "x": 160, "y": 105, "z": 150, "angle_deg": 15, "zoom": 2.0}
    ],

    "lighting_modes": ["direct", "angled"],

    "sensor_overrides": {
        "thermal_anomaly": 0.65,
        "continuity": 0.40
    }
}
```

### 7.2 Scenario Manager

```python
class ScenarioManager:
    def __init__(self, scenarios_dir: str):
        self.scenarios = {}
        self.current = None
        self.observation_number = 0

        for f in Path(scenarios_dir).glob("*.json"):
            with open(f) as fh:
                s = json.load(fh)
                self.scenarios[s["id"]] = s

    def load(self, scenario_id: str):
        self.current = self.scenarios[scenario_id]
        self.observation_number = 0

    def advance(self):
        self.observation_number += 1

    def list_all(self):
        return [{"id": s["id"], "name": s["name"], "description": s["description"]}
                for s in self.scenarios.values()]
```

---

## 8. Timing & Demo Pacing

| Action | Duration (sim) | Adjustable |
|---|---|---|
| Robot move | ~2s | `ROBOT_MOVE_DURATION` / `SIMULATION_SPEED` |
| Camera capture | ~0.8s | `CAMERA_CAPTURE_DELAY` / `SIMULATION_SPEED` |
| CV analysis | Real (~100ms) | Not simulated — actual computation |
| Robot action | ~1.5s | `ROBOT_ACTION_DURATION` / `SIMULATION_SPEED` |

RECHECK scenario total: ~12 seconds (comfortable demo pace).

Speed is configurable: `SIMULATION_SPEED = 2.0` halves all simulated delays.

---

## 9. Cell Coordinate System

```
         Y (mm)
         ▲
  300 ── ┤ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
         │                         │
         │    ┌─────────────┐      │
  200 ── ┤    │     PCB     │      │
         │    │ (test area) │      │
  100 ── ┤    └─────────────┘      │
         │         ●               │
    0 ── ┤─────────┼───────────────┼──→ X (mm)
         │    Robot base           │
 -100 ── ┤                         │
         │ [Reject]         [Pass] │
         0   100  150  200  300

  Z (height): 0 = PCB surface, 400 = home
```

---

## 10. Hardware Migration Checklist

| Step | Action |
|---|---|
| 1 | Implement `USBCamera(CameraInterface)` — `cv2.VideoCapture` |
| 2 | Implement `SerialRobot(RobotInterface)` — serial protocol for arm/gantry |
| 3 | Implement `ESP32Sensors(SensorInterface)` — serial/MQTT from microcontroller |
| 4 | Implement `PWMLighting(LightingInterface)` — PWM commands to LED controller |
| 5 | Set `HARDWARE_MODE = "physical"` in `config.py` |
| 6 | Run same scenarios, tune thresholds for real images |

The inspection engine, scoring, fusion, state machine, and frontend do NOT change.
