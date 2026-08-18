# AURA — Computer Vision Inspection Pipeline Design (Revised)

## 1. Scope

This document specifies:
- The OpenCV detection pipeline (real computation)
- Feature extraction (real computation)
- Defect scoring (heuristic — clearly labeled)
- Evidence fusion (weighted average — clearly labeled)
- RECHECK trigger logic
- Three hero scenarios
- Offline fallback strategy
- What is real vs what is heuristic

---

## 2. Dataset

### 2.1 Primary: DeepPCB (Bundled Subset)

| Attribute | Value |
|---|---|
| **Source** | [github.com/tangsanli5201/DeepPCB](https://github.com/tangsanli5201/DeepPCB) |
| **License** | MIT |
| **What we bundle** | 10–15 curated image pairs (template + test) |
| **Resolution** | 640 × 640 px |
| **Defect types** | Open circuit, short circuit, missing hole, mouse bite, spur, spurious copper |
| **Why** | Paired template/test images are ideal for `cv2.absdiff()` detection |

### 2.2 Offline Fallback: Synthetic PCB Images

If the DeepPCB dataset is unavailable or produces poor results:

```python
def generate_synthetic_pcb(width=640, height=640, defect_type=None):
    """
    Generate a simple PCB image using OpenCV drawing primitives.
    Traces = lines, pads = circles, vias = small circles.
    Defects = gaps in traces (open), bridges between traces (short).
    """
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = (20, 40, 20)  # PCB green

    # Draw traces
    for i in range(5):
        y = 100 + i * 100
        cv2.line(img, (50, y), (590, y), (180, 140, 50), 3)

    # Draw pads
    for x in [100, 300, 500]:
        for y in [100, 200, 300, 400, 500]:
            cv2.circle(img, (x, y), 15, (200, 170, 80), -1)

    template = img.copy()

    # Inject defect
    if defect_type == "open_circuit":
        cv2.line(img, (250, 200), (350, 200), (20, 40, 20), 5)  # Erase trace
    elif defect_type == "short_circuit":
        cv2.line(img, (300, 200), (300, 300), (180, 140, 50), 3)  # Bridge
    elif defect_type == "subtle_short":
        # Barely visible bridge — for RECHECK scenario
        cv2.line(img, (300, 200), (300, 250), (120, 100, 40), 1)

    return template, img
```

This fallback:
- Works **100% offline**
- Produces images that the OpenCV pipeline can genuinely analyze
- Generates different defect scores for different defect severities
- Is clearly synthetic — no pretense of being real PCB photography

### 2.3 What We Actually Need

| Scenario | Template | Test Image | Defect |
|---|---|---|---|
| Clean Board (PASS) | Clean PCB | Same or near-identical clean PCB | None |
| Obvious Defect (FAIL) | Clean PCB | PCB with large visible defect | Open circuit or large short |
| Ambiguous Defect (RECHECK) | Clean PCB | PCB with subtle, barely visible defect | Small solder bridge |
| Ambiguous Defect (RECHECK, view 2) | Clean PCB | Different image / crop of same PCB | Same defect, different angle |

---

## 3. OpenCV Detection Pipeline

### 3.1 Pipeline Architecture

```
Test Image ──┐
             ├──→ Preprocessing ──→ Template Diff ──→ Thresholding
Template ────┘                              │
                                            ▼
                                    Morphological Cleanup
                                            │
                                            ▼
                                    Contour Detection
                                            │
                                            ▼
                                    Region Filtering
                                            │
                                            ▼
                                    Feature Extraction ──→ FeatureVector
                                            │
                                            ▼
                                    Defect Localization ──→ List[DetectedDefect]
                                            │
                                            ▼
                                    Defect Scoring ──→ defect_score (0–1)
                                            │
                                            ▼
                                    (P1) Heatmap ──→ heatmap image
                                            │
                                            ▼
                                        AnalysisResult
```

### 3.2 Implementation

```python
def analyze(test_image: np.ndarray,
            template_image: np.ndarray,
            config: dict) -> AnalysisResult:
    """
    REAL COMPUTATION: every step performs actual OpenCV operations
    on actual pixel data.
    """
    t_start = time.perf_counter()

    # 1. Convert to grayscale
    test_gray = cv2.cvtColor(test_image, cv2.COLOR_BGR2GRAY)
    tmpl_gray = cv2.cvtColor(template_image, cv2.COLOR_BGR2GRAY)

    # 2. Compute absolute difference
    diff = cv2.absdiff(test_gray, tmpl_gray)

    # 3. Gaussian blur to suppress noise
    diff_blur = cv2.GaussianBlur(diff, (5, 5), 0)

    # 4. Threshold to binary anomaly mask
    _, mask = cv2.threshold(diff_blur, config.get("threshold", 30),
                            255, cv2.THRESH_BINARY)

    # 5. Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    # 6. Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL,
                                    cv2.CHAIN_APPROX_SIMPLE)

    # 7. Filter small contours and build defect list
    defects = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < config.get("min_area", 20):
            continue
        x, y, w, h = cv2.boundingRect(contour)
        defects.append(DetectedDefect(
            defect_type=classify_by_geometry(contour, tmpl_gray, x, y, w, h),
            bbox=BBox(x, y, w, h),
            area_pixels=int(area),
            mean_intensity=float(diff[y:y+h, x:x+w].mean()),
            ...
        ))

    # 8. Extract features
    features = extract_features(diff, mask, defects, test_gray)

    # 9. Calculate defect score
    defect_score = calculate_defect_score(features)

    elapsed = (time.perf_counter() - t_start) * 1000

    return AnalysisResult(
        defects=defects,
        defect_score=defect_score,
        features=features,
        processing_time_ms=elapsed,
        method="template_diff"
    )
```

### 3.3 Feature Extraction — All Real Computation

```python
def extract_features(diff: np.ndarray, mask: np.ndarray,
                     defects: list, test_gray: np.ndarray) -> FeatureVector:
    total_pixels = diff.shape[0] * diff.shape[1]
    anomaly_pixels = np.count_nonzero(mask)

    return FeatureVector(
        anomaly_score=float(diff.mean()) / 255.0,
        anomaly_area_ratio=anomaly_pixels / total_pixels,
        max_anomaly_intensity=float(diff.max()) / 255.0,
        edge_discontinuity=compute_edge_score(test_gray, diff),
        contrast_ratio=compute_contrast(diff, mask),
        defect_count=len(defects),
        sharpness=compute_sharpness(test_gray),
    )

def compute_edge_score(test_gray, diff):
    """Compare edge density in anomaly regions vs clean regions."""
    edges = cv2.Canny(test_gray, 50, 150)
    diff_edges = cv2.Canny(diff, 30, 100)
    # High edge diff = broken traces
    return float(diff_edges.mean()) / 255.0

def compute_contrast(diff, mask):
    """Local contrast in anomalous regions."""
    if mask.sum() == 0:
        return 0.0
    anomaly_values = diff[mask > 0]
    return float(anomaly_values.std()) / 128.0 if len(anomaly_values) > 0 else 0.0

def compute_sharpness(gray):
    """Laplacian variance — measures image focus quality."""
    lap = cv2.Laplacian(gray, cv2.CV_64F)
    return min(float(lap.var()) / 500.0, 1.0)
```

---

## 4. Defect Scoring — Honest Heuristic

### 4.1 What Defect Score IS

A **weighted combination of image features** that produces a number from 0.0 (looks clean) to 1.0 (looks defective). It is a **heuristic measure**, NOT a calibrated probability.

### 4.2 Formula — Exact Definition

All five input features MUST be individually normalized to [0, 1] before weighting.

**Input features (all normalized to [0, 1]):**

| Feature | Symbol | Normalization | Source |
|---|---|---|---|
| anomaly_score | `a` | `diff.mean() / 255.0` | Mean of `cv2.absdiff` result |
| anomaly_area_ratio | `r` | `count_nonzero(mask) / total_pixels` | Fraction of image flagged |
| edge_discontinuity | `e` | `Canny(diff).mean() / 255.0` | Edge density in anomaly map |
| contrast_ratio | `c` | `diff[mask>0].std() / 128.0`, clipped to [0,1] | Contrast in anomalous regions |
| defect_count_signal | `n` | `min(defect_count / 3.0, 1.0)` | Saturates at 3 defects |

**Weights (fixed, hand-tuned, sum to 1.0):**

| Weight | Value | Rationale |
|---|---|---|
| w_a | 0.35 | Anomaly magnitude is the strongest single signal |
| w_r | 0.25 | Area of anomaly matters — large defects score higher |
| w_e | 0.15 | Broken edges indicate trace damage |
| w_c | 0.15 | High local contrast indicates a real anomaly, not noise |
| w_n | 0.10 | Multiple defect regions compound severity |

**Formula:**

```
D = clamp( w_a·a + w_r·r + w_e·e + w_c·c + w_n·n,  0.0,  1.0 )
```

```python
def calculate_defect_score(features: FeatureVector) -> float:
    """
    Deterministic weighted combination of normalized detection features.

    IMPORTANT: This is a heuristic score, NOT a probability.
    It represents "how much does this image look defective"
    on a scale from 0 (clean) to 1 (clearly defective).

    All input features are pre-normalized to [0, 1].
    Weights are fixed and hand-tuned (not learned). They sum to 1.0.
    Output is clipped to [0, 1].
    """
    W_ANOMALY     = 0.35
    W_AREA        = 0.25
    W_EDGE        = 0.15
    W_CONTRAST    = 0.15
    W_COUNT       = 0.10

    raw = (
        W_ANOMALY  * features.anomaly_score +
        W_AREA     * features.anomaly_area_ratio +
        W_EDGE     * features.edge_discontinuity +
        W_CONTRAST * features.contrast_ratio +
        W_COUNT    * min(features.defect_count / 3.0, 1.0)
    )
    return max(0.0, min(1.0, raw))
```

**Contour filtering:** Contours with `cv2.contourArea(contour) < MIN_CONTOUR_AREA` (default: 20 pixels) are discarded before feature extraction. This prevents noise from inflating `defect_count_signal`.

**Image quality guard:** If `features.sharpness < MIN_SHARPNESS_THRESHOLD` (default: 0.05), the image is considered too blurry for reliable analysis. The engine should log a warning and proceed with reduced confidence, but NOT refuse to analyze.

### 4.3 Decision Confidence — Separate Concept

```python
def calculate_decision_confidence(defect_score: float,
                                   evidence_count: int = 1,
                                   agreement: float = 1.0) -> float:
    """
    How clear-cut is the decision?

    Confidence is HIGH when the score is far from 0.5 (the ambiguous midpoint).
    Confidence is LOW when the score is near 0.5.

    This is an INFORMATIONAL metric. It does NOT drive the decision.
    The decision is driven by defect_score vs thresholds.
    """
    # Base: distance from ambiguity
    clarity = 2.0 * abs(defect_score - 0.5)

    # Boost slightly with more evidence
    evidence_bonus = min((evidence_count - 1) * 0.05, 0.15)

    # Agreement factor (only relevant with multiple observations)
    confidence = clarity * (0.7 + 0.3 * agreement) + evidence_bonus

    return max(0.0, min(1.0, confidence))
```

### 4.4 What Drives the Decision

```python
MAX_RECHECKS = 1  # One recheck for MVP hackathon build

def evaluate_score(defect_score: float, recheck_count: int,
                   is_fused: bool) -> str:
    """
    Decision logic: score vs thresholds.
    Returns "PASS", "FAIL", or "RECHECK".

    This function NEVER reads scenario ground truth.
    Decision is driven ONLY by the computed defect score.
    """
    if is_fused:
        pass_thresh = FUSED_PASS_THRESHOLD  # 0.35
        fail_thresh = FUSED_FAIL_THRESHOLD  # 0.60
    else:
        pass_thresh = PASS_THRESHOLD  # 0.30
        fail_thresh = FAIL_THRESHOLD  # 0.70

    if defect_score < pass_thresh:
        return "PASS"
    elif defect_score > fail_thresh:
        return "FAIL"
    elif recheck_count < MAX_RECHECKS:
        return "RECHECK"
    else:
        # Forced decision after single recheck — deterministic tiebreaker
        return "FAIL" if defect_score > 0.50 else "PASS"
```

---

## 5. Evidence Fusion — Weighted Score Aggregation

### 5.1 What This IS

A **reliability-weighted average** of defect scores from multiple evidence sources. It is NOT Bayesian inference. It is NOT calibrated probability math. It is a clearly defined aggregation formula.

### 5.2 Formula — Exact Mathematical Definition

Given N evidence items, each with defect score D_i and reliability weight R_i:

```
F = Σ(D_i × R_i) / Σ(R_i)    for i = 1..N

where:
  D_i = defect score of evidence item i (heuristic, 0–1)
  R_i = reliability weight of evidence item i (fixed per source type, 0–1)
  F   = fused defect score (NOT a probability)
```

**Agreement metric:**

```
A = 1.0 − (max(D_i) − min(D_i))    for i = 1..N

where:
  A = 1.0 means all sources agree perfectly
  A = 0.0 means maximum disagreement (one source says 0.0, another says 1.0)
```

F is a weighted average. It is NOT Bayesian. It is NOT a probability.

### 5.3 Implementation

```python
def fuse_evidence(evidence_items: List[EvidenceItem]) -> FusedResult:
    """
    Combines defect scores from multiple sources using
    reliability-weighted averaging.

    Each source provides:
      - defect_score: 0.0 (clean) to 1.0 (defective) — heuristic
      - reliability: 0.0 to 1.0 — how much we trust this source (fixed per type)

    This is a weighted average, not Bayesian inference.
    """
    if not evidence_items:
        return FusedResult(fused_defect_score=0.5, decision_confidence=0.0, ...)

    weighted_sum = sum(e.reliability * e.defect_score for e in evidence_items)
    weight_total = sum(e.reliability for e in evidence_items)

    fused_score = weighted_sum / weight_total

    # Agreement: do sources point the same direction?
    scores = [e.defect_score for e in evidence_items]
    score_range = max(scores) - min(scores) if len(scores) > 1 else 0.0
    agreement = 1.0 - min(score_range, 1.0)

    # Decision confidence for the fused result
    decision_confidence = calculate_decision_confidence(
        fused_score,
        evidence_count=len(evidence_items),
        agreement=agreement
    )

    contributions = [
        {
            "source": e.source,
            "defect_score": e.defect_score,
            "reliability": e.reliability,
            "is_simulated": e.is_simulated,
            "weighted_contribution": e.reliability * e.defect_score / weight_total
        }
        for e in evidence_items
    ]

    return FusedResult(
        fused_defect_score=fused_score,
        decision_confidence=decision_confidence,
        evidence_count=len(evidence_items),
        agreement=agreement,
        contributions=contributions,
        method="reliability_weighted_average"
    )
```

### 5.4 Source Reliability Weights

| Source | Reliability | Rationale |
|---|---|---|
| Visual observation #1 | 1.0 | Primary evidence, real CV analysis |
| Visual observation #2 (recheck) | 1.0 | Real CV analysis, different viewpoint |
| Thermal sensor [SIMULATED] | 0.5 | Simulated, lower trust | P1 |
| Electrical probe [SIMULATED] | 0.5 | Simulated, lower trust | P1 |

Simulated sensors are weighted lower because they are **not physically measured**. This is honest — we do not pretend virtual sensors have the same evidential weight as real analysis.

### 5.5 Why NOT Bayesian

The original design used Bayesian log-odds fusion, but this had a mathematical problem: `evidence.value` was treated simultaneously as a probability and as `P(evidence | defect)`, which is incoherent. Bayesian inference requires:
- A well-defined prior: `P(defect)` — but we have no calibrated prior for arbitrary PCBs.
- A well-defined likelihood: `P(evidence | defect)` — but our defect score is a heuristic, not a likelihood.
- Conditional independence: `P(obs2 | defect) ⊥ P(obs1 | defect)` — not guaranteed.

A reliability-weighted average is:
- Mathematically defensible (it's a weighted mean — unambiguous)
- Clearly named (not pretending to be something it isn't)
- Easy to explain to judges
- Implementable in 3 lines

---

## 6. Defect Classification — Rule-Based

### 6.1 Method

Geometric heuristics — no trained model required:

```python
def classify_by_geometry(contour, template_gray, x, y, w, h) -> str:
    area = cv2.contourArea(contour)
    hull = cv2.convexHull(contour)
    solidity = area / max(cv2.contourArea(hull), 1)
    aspect = w / max(h, 1)

    # Is the defect region on a trace in the template?
    template_region = template_gray[y:y+h, x:x+w]
    on_trace = template_region.mean() > 128

    if on_trace and aspect > 2.5:
        return "open_circuit"       # Long thin gap in trace
    elif not on_trace and solidity > 0.6:
        return "short_circuit"      # Solid blob bridging traces
    elif not on_trace and area < 80:
        return "spur"               # Small protrusion
    elif on_trace and solidity < 0.4:
        return "mouse_bite"         # Irregular edge on trace
    else:
        return "anomaly"            # Generic
```

### 6.2 Honesty

This is a **rule-based heuristic**, not a trained classifier. It makes classification errors. For the hackathon demo, the defect TYPE is secondary — what matters is detection and scoring. The type label adds context but does not drive the decision.

---

## 7. RECHECK — What Makes the Second Observation Different

### 7.1 Genuinely Different Evidence

The RECHECK must NOT simply re-run the same analysis. The second observation differs by:

| Parameter | Observation 1 | Observation 2 (Recheck) |
|---|---|---|
| Camera height (Z) | 300mm (overview) | 150mm (close-up) |
| Camera angle | 0° (top-down) | 15–30° (angled) |
| Zoom | 1.0× | 2.0× (cropped to defect ROI) |
| Lighting | Direct | Angled (45° side illumination) |
| Image processing | Standard | Enhanced contrast, histogram equalization |

### 7.2 How the Virtual Camera Produces a Different Image

Option A — **Different image file**: The scenario provides a separate test image for each observation (ideal).

Option B — **Image transformation**: When only one test image is available, the recheck view is generated by:
1. Cropping around the suspected defect region (simulates zoom)
2. Applying perspective warp (simulates angled view)
3. Adjusting brightness/contrast (simulates different lighting)
4. Applying histogram equalization (reveals low-contrast features)

```python
def create_recheck_view(image, defect_bbox, config):
    """Create a genuinely different view for the recheck observation."""
    # 1. Crop around suspect region with padding
    pad = 80
    x, y, w, h = defect_bbox
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(image.shape[1], x + w + pad)
    y2 = min(image.shape[0], y + h + pad)
    cropped = image[y1:y2, x1:x2]

    # 2. Resize back to standard resolution
    cropped = cv2.resize(cropped, (640, 640))

    # 3. Apply histogram equalization to enhance contrast
    if len(cropped.shape) == 3:
        lab = cv2.cvtColor(cropped, cv2.COLOR_BGR2LAB)
        lab[:,:,0] = cv2.equalizeHist(lab[:,:,0])
        cropped = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # 4. Adjust brightness/contrast for angled lighting
    alpha = 1.3  # Contrast
    beta = 10    # Brightness
    cropped = cv2.convertScaleAbs(cropped, alpha=alpha, beta=beta)

    return cropped
```

The result: the OpenCV pipeline genuinely produces a **different defect score** for the recheck view because the image data is different.

---

## 8. Three Hero Scenarios

> **GROUND TRUTH ISOLATION RULE**: The fields `expected_result`, `expected_path`,
> and `defect_annotations` in scenario JSON files are **evaluation/test metadata ONLY**.
> The production inspection engine MUST NOT read `expected_result`, `expected_path`,
> or ground-truth defect annotations when making a decision. Runtime decisions
> depend ONLY on the output of the CV pipeline and evidence fusion.

### Scenario A: Clean Board → PASS

| | |
|---|---|
| **Template** | Clean PCB reference |
| **Test image** | Same or near-identical clean image |
| **Target defect score** | < 0.15 (obtained via actual CV pipeline, not assigned) |
| **Expected path** | POSITIONING → ACQUIRING → ANALYZING → EVALUATING → DECIDING → ACTING → COMPLETE |
| **Decision** | PASS (score well below 0.30 threshold) |
| **Demo time** | ~5 seconds |

### Scenario B: Obvious Defect → FAIL

| | |
|---|---|
| **Template** | Clean PCB reference |
| **Test image** | PCB with large, clearly visible open circuit |
| **Target defect score** | > 0.80 (obtained via actual CV pipeline, not assigned) |
| **Expected path** | POSITIONING → ACQUIRING → ANALYZING → EVALUATING → DECIDING → ACTING → COMPLETE |
| **Decision** | FAIL (score well above 0.70 threshold) |
| **Demo time** | ~5 seconds |

### Scenario C: Ambiguous Defect → RECHECK → FAIL (THE HERO)

| | |
|---|---|
| **Template** | Clean PCB reference |
| **Test image (obs 1)** | PCB with subtle, barely visible solder bridge |
| **Test image (obs 2)** | Zoomed/enhanced view of the same region |
| **Target score (obs 1)** | ~0.48 (obtained via actual CV pipeline, not assigned) |
| **Target score (obs 2)** | ~0.78 (obtained via actual CV pipeline, not assigned) |
| **Target fused score** | F = (1.0×0.48 + 1.0×0.78) / (1.0+1.0) = 0.63 |
| **Expected path** | POSITIONING → ACQUIRING → ANALYZING → EVALUATING → **RECHECKING** → POSITIONING → ACQUIRING → ANALYZING → FUSING → EVALUATING → DECIDING → ACTING → COMPLETE |
| **Decision** | FAIL (fused score 0.63 > FUSED_FAIL_THRESHOLD 0.60) |
| **Demo time** | ~12 seconds |
| **Demo impact** | Shows the complete RECHECK loop — the core differentiator |

> **Important**: The target scores above are design goals for image/threshold selection.
> The implementation MUST obtain these scores through the actual CV/scoring pipeline.
> During Phase 2, images and thresholds are tuned so that the pipeline naturally
> produces scores in these ranges. Scores are NEVER hardcoded or assigned at runtime.

---

## 9. Performance Budget

| Operation | Target | Real? |
|---|---|---|
| Image loading | < 20ms | Real I/O |
| Grayscale conversion | < 5ms | Real OpenCV |
| Template diff | < 10ms | Real `cv2.absdiff` |
| Thresholding + morphology | < 10ms | Real OpenCV |
| Contour detection | < 10ms | Real OpenCV |
| Feature extraction | < 15ms | Real computation |
| Defect scoring | < 1ms | Real math |
| Heatmap (P1) | < 15ms | Real OpenCV |
| **Total per observation** | **< 100ms** | All real |
| Evidence fusion | < 1ms | Real math |
| Decision | < 1ms | Real math |

The entire pipeline runs in under 100ms on a laptop CPU. Simulated delays (robot motion, capture) are added purely for visual pacing.
