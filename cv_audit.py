import cv2
import numpy as np
import traceback
from backend.detector import DefectDetector

def run_audit():
    detector = DefectDetector()
    template = cv2.imread("data/images/templates/board_01_clean.png")
    
    test_cases = {
        "Clean": cv2.imread("data/images/test/board_01_clean.png"),
        "Obvious": cv2.imread("data/images/test/board_01_obvious_defect.png"),
        "Subtle": cv2.imread("data/images/test/board_01_subtle_defect.png"),
        "Zoomed": cv2.imread("data/images/test/board_01_subtle_defect_zoomed.png"),
    }
    
    # Intentionally break the images to test robustness
    print("--- 1. Testing Size Mismatch ---")
    bad_size = cv2.resize(test_cases["Clean"], (400, 400))
    try:
        detector.analyze(bad_size, template)
        print("FAIL: Processed mismatched sizes without error or alignment.")
    except Exception as e:
        print("CRASH: Size mismatch caused pipeline to crash.")
        print(traceback.format_exc().split('\n')[-2])
        
    print("\n--- 2. Testing Channel Mismatch ---")
    bad_channel = cv2.cvtColor(test_cases["Clean"], cv2.COLOR_BGR2GRAY)
    try:
        detector.analyze(bad_channel, template)
        print("FAIL: Processed 1-channel image without handling.")
    except Exception as e:
        print("CRASH: Channel mismatch caused pipeline to crash.")
        print(traceback.format_exc().split('\n')[-2])
        
    print("\n--- 3. Testing Translation Shift (Alignment test) ---")
    M = np.float32([[1, 0, 5], [0, 1, 5]]) # 5 pixel shift
    shifted = cv2.warpAffine(test_cases["Clean"], M, (640, 640))
    res_clean = detector.analyze(test_cases["Clean"], template).defect_score
    res_shifted = detector.analyze(shifted, template).defect_score
    print(f"Original Clean Score: {res_clean:.3f}")
    print(f"Shifted Clean Score:  {res_shifted:.3f}")
    if res_shifted > 0.40:
        print("CRITICAL WEAKNESS: Slight camera translation causes massive false positive!")
        
    print("\n--- 4. Feature Variance Test ---")
    for name, img in test_cases.items():
        res = detector.analyze(img, template)
        print(f"[{name}] Score: {res.defect_score:.3f} | Area ratio: {res.features.anomaly_area_ratio:.3f} | Edges: {res.features.edge_discontinuity:.3f}")

if __name__ == "__main__":
    run_audit()
