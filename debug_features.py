import cv2
from backend.detector import DefectDetector

detector = DefectDetector()
template = cv2.imread("data/images/templates/board_01_clean.png")
obvious = cv2.imread("data/images/test/board_01_obvious_defect.png")

result = detector.analyze(obvious, template)
print("Defect Score:", result.defect_score)
print("Features:", result.features)
print("Defects:", [(d.defect_type, d.area_pixels) for d in result.defects])
