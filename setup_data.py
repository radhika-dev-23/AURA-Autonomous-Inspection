import os
import cv2
import numpy as np
import json
from pathlib import Path

def create_dirs():
    dirs = [
        "backend",
        "frontend",
        "data/images/templates",
        "data/images/test",
        "data/scenarios"
    ]
    for d in dirs:
        os.makedirs(d, exist_ok=True)
    
    Path("backend/__init__.py").touch()

def generate_pcb(width=640, height=640, defect_type=None):
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = (20, 40, 20)  # PCB green

    # Draw traces
    for i in range(5):
        y = 100 + i * 100
        cv2.line(img, (50, y), (590, y), (180, 140, 50), 30)

    # Draw pads
    for x in [100, 300, 500]:
        for y in [100, 200, 300, 400, 500]:
            cv2.circle(img, (x, y), 35, (200, 170, 80), -1)

    template = img.copy()

    # Inject defect
    if defect_type == "open_circuit":
        # Massive defect covering ~80% of image
        x, y, w, h = 60, 60, 520, 520
        noise = np.random.randint(150, 255, (h, w, 3), dtype=np.uint8)
        img[y:y+h, x:x+w] = noise
    elif defect_type == "subtle_short":
        # Medium defect covering ~25% of image
        x, y, w, h = 160, 160, 320, 320
        noise = np.random.randint(150, 255, (h, w, 3), dtype=np.uint8)
        img[y:y+h, x:x+w] = noise

    return template, img

def generate_images():
    template, clean = generate_pcb(defect_type=None)
    _, obvious = generate_pcb(defect_type="open_circuit")
    _, subtle = generate_pcb(defect_type="subtle_short")
    
    pad = 20
    x, y, w, h = 160, 160, 320, 320  # Bounding box around subtle short
    x1, y1 = max(0, x - pad), max(0, y - pad)
    x2 = min(subtle.shape[1], x + w + pad)
    y2 = min(subtle.shape[0], y + h + pad)
    zoomed = subtle[y1:y2, x1:x2]
    zoomed = cv2.resize(zoomed, (640, 640))
    lab = cv2.cvtColor(zoomed, cv2.COLOR_BGR2LAB)
    lab[:, :, 0] = cv2.equalizeHist(lab[:, :, 0])
    zoomed = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    zoomed = cv2.convertScaleAbs(zoomed, alpha=1.3, beta=10)

    cv2.imwrite("data/images/templates/board_01_clean.png", template)
    cv2.imwrite("data/images/test/board_01_clean.png", clean)
    cv2.imwrite("data/images/test/board_01_obvious_defect.png", obvious)
    cv2.imwrite("data/images/test/board_01_subtle_defect.png", subtle)
    cv2.imwrite("data/images/test/board_01_subtle_defect_zoomed.png", zoomed)

def generate_scenarios():
    clean_scenario = {
        "id": "clean_board",
        "name": "Clean Board \u2014 PASS Expected",
        "description": "Defect-free PCB. Demonstrates confident PASS.",
        "expected_result": "PASS",
        "expected_path": "direct",
        "template_image": "data/images/templates/board_01_clean.png",
        "test_images": ["data/images/test/board_01_clean.png"],
        "defect_annotations": [],
        "inspection_positions": [
            {"label": "primary", "x": 150, "y": 100, "z": 300, "angle_deg": 0, "zoom": 1.0}
        ],
        "lighting_modes": ["direct"],
        "sensor_overrides": {"thermal_anomaly": 0.05, "continuity": 0.98}
    }

    obvious_scenario = {
        "id": "obvious_defect",
        "name": "Obvious Open Circuit \u2014 FAIL Expected",
        "description": "Large visible defect. Demonstrates confident FAIL.",
        "expected_result": "FAIL",
        "expected_path": "direct",
        "template_image": "data/images/templates/board_01_clean.png",
        "test_images": ["data/images/test/board_01_obvious_defect.png"],
        "defect_annotations": [
            {"type": "open_circuit", "bbox": {"x": 240, "y": 180, "w": 120, "h": 40}, "severity": "CRITICAL"}
        ],
        "inspection_positions": [
            {"label": "primary", "x": 150, "y": 100, "z": 300, "angle_deg": 0, "zoom": 1.0}
        ],
        "lighting_modes": ["direct"],
        "sensor_overrides": {"thermal_anomaly": 0.85, "continuity": 0.10}
    }

    recheck_scenario = {
        "id": "ambiguous_recheck",
        "name": "Subtle Solder Bridge \u2014 RECHECK Demo",
        "description": "Barely visible bridge between traces. First observation is uncertain. RECHECK confirms.",
        "expected_result": "FAIL",
        "expected_path": "recheck",
        "template_image": "data/images/templates/board_01_clean.png",
        "test_images": [
            "data/images/test/board_01_subtle_defect.png",
            "data/images/test/board_01_subtle_defect_zoomed.png"
        ],
        "defect_annotations": [
            {"type": "short_circuit", "bbox": {"x": 280, "y": 180, "w": 40, "h": 90}, "severity": "HIGH"}
        ],
        "inspection_positions": [
            {"label": "primary", "x": 150, "y": 100, "z": 300, "angle_deg": 0, "zoom": 1.0},
            {"label": "recheck_close", "x": 160, "y": 105, "z": 150, "angle_deg": 15, "zoom": 2.0}
        ],
        "lighting_modes": ["direct", "angled"],
        "sensor_overrides": {"thermal_anomaly": 0.65, "continuity": 0.40}
    }

    with open("data/scenarios/clean_board.json", "w") as f:
        json.dump(clean_scenario, f, indent=4)
    with open("data/scenarios/obvious_defect.json", "w") as f:
        json.dump(obvious_scenario, f, indent=4)
    with open("data/scenarios/ambiguous_recheck.json", "w") as f:
        json.dump(recheck_scenario, f, indent=4)

if __name__ == "__main__":
    print("Creating directories...")
    create_dirs()
    print("Generating images...")
    generate_images()
    print("Generating scenarios...")
    generate_scenarios()
    print("Done!")
