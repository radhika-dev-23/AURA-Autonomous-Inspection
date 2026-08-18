from .models import Inspection, EvidenceItem
from typing import List

class StructuredExplainer:
    def __init__(self, inspection: Inspection):
        self.inspection = inspection

    def generate_reasoning(self) -> List[str]:
        reasoning = []
        
        rechecks = self.inspection.recheck_count
        score = self.inspection.decision.defect_score
        
        if rechecks == 0:
            reasoning.append("Decision made after a single observation.")
        else:
            reasoning.append(f"Decision made after initial ambiguity required {rechecks} recheck(s).")
            
        reasoning.append(f"Final calculated defect score is {score:.3f}.")
        
        if self.inspection.fused_score is not None:
            reasoning.append("Score was determined by fusing multiple observations.")
            for i, ev in enumerate(self.inspection.evidence_items):
                reasoning.append(f"  - Observation {i+1} score: {ev.defect_score:.3f} (Reliability: {ev.reliability:.2f})")
            
            from .config import FUSED_PASS_THRESHOLD, FUSED_FAIL_THRESHOLD, MAX_RECHECKS
            if self.inspection.fused_score > FUSED_PASS_THRESHOLD and self.inspection.fused_score <= FUSED_FAIL_THRESHOLD:
                if rechecks >= MAX_RECHECKS:
                    reasoning.append(f"Maximum rechecks ({MAX_RECHECKS}) reached. Applying conservative reject policy since fused score ({score:.3f}) exceeds pass threshold ({FUSED_PASS_THRESHOLD:.2f}).")
        
        if self.inspection.decision.result == "PASS":
            reasoning.append("The board meets quality standards and is clear of critical defects.")
        elif self.inspection.decision.result == "FAIL":
            reasoning.append("The board failed quality standards due to significant anomalies.")
            
        return reasoning
