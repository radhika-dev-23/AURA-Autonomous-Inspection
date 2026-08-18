import cv2
from backend.detector import DefectDetector

detector = DefectDetector()
template = cv2.imread("data/images/templates/board_01_clean.png")
clean = cv2.imread("data/images/test/board_01_clean.png")
obvious = cv2.imread("data/images/test/board_01_obvious_defect.png")
subtle = cv2.imread("data/images/test/board_01_subtle_defect.png")
zoomed = cv2.imread("data/images/test/board_01_subtle_defect_zoomed.png")

print("--- DEFFECT SCORES ---")
print(f"Clean:   {detector.analyze(clean, template).defect_score:.3f} (expected < 0.30)")
print(f"Obvious: {detector.analyze(obvious, template).defect_score:.3f} (expected > 0.70)")
print(f"Subtle:  {detector.analyze(subtle, template).defect_score:.3f} (expected 0.30 - 0.70)")
print(f"Zoomed:  {detector.analyze(zoomed, template).defect_score:.3f} (expected > 0.70 or higher than subtle)")
