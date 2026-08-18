import asyncio
import cv2
from .config import CAMERA_CAPTURE_DELAY, ROBOT_MOVE_DURATION
from .models import Scenario

class VirtualCamera:
    def __init__(self):
        self.is_simulated = True

    async def acquire_image(self, scenario: Scenario, obs_number: int) -> tuple[str, cv2.typing.MatLike]:
        await asyncio.sleep(CAMERA_CAPTURE_DELAY / 1000.0)
        
        idx = min(obs_number, len(scenario.test_images) - 1)
        path = scenario.test_images[idx]
        img = cv2.imread(path)
        if img is None:
            raise FileNotFoundError(f"VirtualCamera failed to read {path}")
        return path, img

class VirtualRobot:
    def __init__(self):
        self.is_simulated = True

    async def move_to(self, position):
        await asyncio.sleep(ROBOT_MOVE_DURATION / 1000.0)
        return True

class VirtualSensors:
    def __init__(self):
        self.is_simulated = True

    def read_thermal_anomaly(self, overrides: dict) -> float:
        return overrides.get("thermal_anomaly", 0.05)
