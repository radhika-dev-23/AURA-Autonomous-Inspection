from typing import List
from .models import EvidenceItem, FusedResult
from .config import PASS_THRESHOLD, FAIL_THRESHOLD, FUSED_PASS_THRESHOLD, FUSED_FAIL_THRESHOLD, MAX_RECHECKS
from .models import FeatureVector

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
    W_ANOMALY     = 0.20
    W_AREA        = 0.20
    W_EDGE        = 0.15
    W_CONTRAST    = 0.15
    W_INTENSITY   = 0.20
    W_COUNT       = 0.10

    raw = (
        W_ANOMALY   * features.anomaly_score +
        W_AREA      * features.anomaly_area_ratio +
        W_EDGE      * features.edge_discontinuity +
        W_CONTRAST  * features.contrast_ratio +
        W_INTENSITY * features.max_anomaly_intensity +
        W_COUNT     * min(features.defect_count / 3.0, 1.0)
    )
    return max(0.0, min(1.0, raw))

def calculate_decision_confidence(defect_score: float, evidence_count: int = 1, agreement: float = 1.0) -> float:
    """
    How clear-cut is the decision?
    Confidence is HIGH when the score is far from 0.5.
    This is an INFORMATIONAL metric. It does NOT drive the decision.
    """
    clarity = 2.0 * abs(defect_score - 0.5)
    evidence_bonus = min((evidence_count - 1) * 0.05, 0.15)
    confidence = clarity * (0.7 + 0.3 * agreement) + evidence_bonus
    return max(0.0, min(1.0, confidence))

def evaluate_score(defect_score: float, recheck_count: int, is_fused: bool) -> str:
    """
    Decision logic: score vs thresholds.
    Returns "PASS", "FAIL", or "RECHECK".
    """
    if is_fused:
        pass_thresh = FUSED_PASS_THRESHOLD
        fail_thresh = FUSED_FAIL_THRESHOLD
    else:
        pass_thresh = PASS_THRESHOLD
        fail_thresh = FAIL_THRESHOLD

    if defect_score < pass_thresh:
        return "PASS"
    elif defect_score > fail_thresh:
        return "FAIL"
    elif recheck_count < MAX_RECHECKS:
        return "RECHECK"
    else:
        # Forced decision after max rechecks: conservative reject
        return "FAIL" if defect_score > pass_thresh else "PASS"

def fuse_evidence(evidence_items: List[EvidenceItem]) -> FusedResult:
    """
    Combines defect scores from multiple sources using reliability-weighted averaging.
    F = Σ(D_i * R_i) / Σ(R_i)
    """
    if not evidence_items:
        return FusedResult(fused_defect_score=0.5, decision_confidence=0.0, evidence_count=0, agreement=0.0, contributions=[], method="none")

    weighted_sum = sum(e.reliability * e.defect_score for e in evidence_items)
    weight_total = sum(e.reliability for e in evidence_items)

    fused_score = weighted_sum / weight_total if weight_total > 0 else 0.5

    # Agreement metric
    scores = [e.defect_score for e in evidence_items]
    score_range = max(scores) - min(scores) if len(scores) > 1 else 0.0
    agreement = max(0.0, min(1.0, 1.0 - score_range))

    decision_confidence = calculate_decision_confidence(fused_score, len(evidence_items), agreement)

    contributions = [
        {
            "source": e.source,
            "defect_score": e.defect_score,
            "reliability": e.reliability,
            "is_simulated": e.is_simulated,
            "weighted_contribution": (e.reliability * e.defect_score / weight_total) if weight_total > 0 else 0
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
