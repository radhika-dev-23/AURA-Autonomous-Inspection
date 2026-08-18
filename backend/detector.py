import cv2
import numpy as np
import time
from .models import AnalysisResult, DetectedDefect, BBox, FeatureVector
from .scoring import calculate_defect_score

class DefectDetector:
    def __init__(self, config=None):
        self.config = config or {}
        self.threshold = self.config.get("threshold", 30)
        self.min_area = self.config.get("min_area", 20)
        self.min_sharpness = self.config.get("min_sharpness", 0.05)

    def analyze(self, test_image: np.ndarray, template_image: np.ndarray) -> AnalysisResult:
        """
        REAL COMPUTATION: OpenCV absolute difference pipeline.
        """
        t_start = time.perf_counter()

        # Safely handle channels
        if len(test_image.shape) == 2: test_gray = test_image.copy()
        elif test_image.shape[2] == 4: test_gray = cv2.cvtColor(test_image, cv2.COLOR_BGRA2GRAY)
        else: test_gray = cv2.cvtColor(test_image, cv2.COLOR_BGR2GRAY)

        if len(template_image.shape) == 2: tmpl_gray = template_image.copy()
        elif template_image.shape[2] == 4: tmpl_gray = cv2.cvtColor(template_image, cv2.COLOR_BGRA2GRAY)
        else: tmpl_gray = cv2.cvtColor(template_image, cv2.COLOR_BGR2GRAY)

        # Safely handle size mismatch
        if test_gray.shape != tmpl_gray.shape:
            test_gray = cv2.resize(test_gray, (tmpl_gray.shape[1], tmpl_gray.shape[0]))

        # Align images using Phase Correlation to prevent false positives from slight shifts
        shift, _ = cv2.phaseCorrelate(np.float32(tmpl_gray), np.float32(test_gray))
        dx, dy = shift
        if abs(dx) < tmpl_gray.shape[1]/4 and abs(dy) < tmpl_gray.shape[0]/4:
            M = np.float32([[1, 0, -dx], [0, 1, -dy]])
            test_gray = cv2.warpAffine(test_gray, M, (tmpl_gray.shape[1], tmpl_gray.shape[0]))

        diff = cv2.absdiff(test_gray, tmpl_gray)
        diff_blur = cv2.GaussianBlur(diff, (5, 5), 0)

        _, mask = cv2.threshold(diff_blur, self.threshold, 255, cv2.THRESH_BINARY)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        defects = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < self.min_area:
                continue
            x, y, w, h = cv2.boundingRect(contour)
            defect_type = self._classify_by_geometry(contour, tmpl_gray, x, y, w, h)
            mean_intensity = float(diff[y:y+h, x:x+w].mean())
            
            # Simple severity mapping based on area
            if area > 1000: severity = "CRITICAL"
            elif area > 300: severity = "HIGH"
            elif area > 100: severity = "MEDIUM"
            else: severity = "LOW"
            
            defects.append(DetectedDefect(
                defect_type=defect_type,
                bbox=BBox(x, y, w, h),
                severity=severity,
                area_pixels=int(area),
                mean_intensity=mean_intensity,
                description=f"{severity} {defect_type} detected"
            ))

        features = self._extract_features(diff, mask, defects, test_gray)
        defect_score = calculate_defect_score(features)

        heatmap_base64 = None
        heatmap = cv2.applyColorMap(diff, cv2.COLORMAP_JET)
        cv2.imwrite("data/pcb/test/current_diff.jpg", diff)
        cv2.imwrite("data/pcb/test/current_heatmap.jpg", heatmap)

        elapsed = (time.perf_counter() - t_start) * 1000

        return AnalysisResult(
            defects=defects,
            defect_score=defect_score,
            features=features,
            heatmap_base64=heatmap_base64,
            processing_time_ms=elapsed,
            method="template_diff"
        )

    def _classify_by_geometry(self, contour, template_gray, x, y, w, h) -> str:
        area = cv2.contourArea(contour)
        hull = cv2.convexHull(contour)
        solidity = area / max(cv2.contourArea(hull), 1)
        aspect = max(w / max(h, 1), h / max(w, 1))

        template_region = template_gray[y:y+h, x:x+w]
        on_trace = template_region.mean() > 64

        if on_trace and aspect > 2.5:
            return "open_circuit"
        elif not on_trace and solidity > 0.6:
            return "solder_bridge"
        elif not on_trace and area < 80:
            return "spur"
        elif on_trace and solidity < 0.4:
            return "mouse_bite"
        else:
            return "anomaly"

    def _extract_features(self, diff: np.ndarray, mask: np.ndarray, defects: list, test_gray: np.ndarray) -> FeatureVector:
        total_pixels = diff.shape[0] * diff.shape[1]
        anomaly_pixels = np.count_nonzero(mask)

        # anomaly_score
        anomaly_score = float(diff.mean()) / 255.0
        
        # anomaly_area_ratio
        anomaly_area_ratio = anomaly_pixels / total_pixels
        
        # max_anomaly_intensity
        max_anomaly_intensity = float(diff.max()) / 255.0
        
        # edge_discontinuity
        diff_edges = cv2.Canny(diff, 30, 100)
        edge_discontinuity = float(diff_edges.mean()) / 255.0
        
        # contrast_ratio
        if anomaly_pixels == 0:
            contrast_ratio = 0.0
        else:
            anomaly_values = diff[mask > 0]
            contrast_ratio = min(float(anomaly_values.std()) / 128.0, 1.0)

        # sharpness
        lap = cv2.Laplacian(test_gray, cv2.CV_64F)
        sharpness = min(float(lap.var()) / 500.0, 1.0)

        return FeatureVector(
            anomaly_score=anomaly_score,
            anomaly_area_ratio=anomaly_area_ratio,
            max_anomaly_intensity=max_anomaly_intensity,
            edge_discontinuity=edge_discontinuity,
            contrast_ratio=contrast_ratio,
            defect_count=len(defects),
            sharpness=sharpness
        )
