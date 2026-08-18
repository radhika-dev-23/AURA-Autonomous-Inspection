import asyncio
import uuid
import cv2
from datetime import datetime

from .models import Inspection, State, TimelineEvent, Observation, EvidenceItem, Decision
from .state_machine import StateMachine, Trigger
from .ws_manager import manager
from .simulation import VirtualCamera, VirtualRobot, VirtualSensors
from .detector import DefectDetector
from .scoring import calculate_decision_confidence, evaluate_score, fuse_evidence
from .explainer import StructuredExplainer
from .config import ROBOT_ACTION_DURATION

class InspectionEngine:
    def __init__(self, scenario):
        self.scenario = scenario
        self.fsm = StateMachine()
        self.camera = VirtualCamera()
        self.robot = VirtualRobot()
        self.sensors = VirtualSensors()
        self.detector = DefectDetector()
        
        self.inspection = Inspection(
            id=str(uuid.uuid4()),
            scenario_id=scenario.id,
            status=State.IDLE,
            observations=[],
            evidence_items=[],
            fused_score=None,
            decision=None,
            timeline=[],
            recheck_count=0,
            started_at=datetime.utcnow(),
            completed_at=None
        )

    async def _emit_state(self):
        score = None
        confidence = None
        defects_payload = []
        obs_scores = []

        if self.inspection.evidence_items:
            score = self.inspection.evidence_items[-1].defect_score
            for ev in self.inspection.evidence_items:
                obs_scores.append(ev.defect_score)

        # Include defects from latest observation
        if self.inspection.observations and self.inspection.observations[-1].analysis:
            for d in self.inspection.observations[-1].analysis.defects:
                defects_payload.append({
                    "bbox": {"x": d.bbox.x, "y": d.bbox.y, "w": d.bbox.w, "h": d.bbox.h},
                    "severity": d.severity,
                    "defect_type": d.defect_type
                })

        msg = {
            "type": "state_update",
            "state": self.inspection.status,
            "scenario": self.scenario.name,
            "rechecks": self.inspection.recheck_count,
            "current_image_path": getattr(self, "_current_path", None),
            "current_score": score,
            "confidence": confidence,
            "fused_score": self.inspection.fused_score,
            "defects": defects_payload,
            "obs_scores": obs_scores,
            "timeline": [
                {
                    "time": t.timestamp.isoformat(),
                    "state": t.state,
                    "event": t.event_type,
                    "desc": t.description
                } for t in self.inspection.timeline
            ]
        }
        await manager.broadcast(msg)

    async def _add_event(self, event_type: str, description: str, data: dict = None):
        evt = TimelineEvent(
            timestamp=datetime.utcnow(),
            state=self.inspection.status,
            event_type=event_type,
            description=description,
            data=data
        )
        self.inspection.timeline.append(evt)
        await self._emit_state()

    def _trigger(self, trigger: Trigger):
        new_state = self.fsm.next_state(self.inspection.status, trigger)
        self.inspection.status = new_state

    async def run(self):
        try:
            await self._add_event("START", "Inspection started")
            self._trigger(Trigger.START)
            
            while self.inspection.status not in (State.COMPLETE, State.ERROR, State.IDLE):
                if self.inspection.status == State.POSITIONING:
                    await self._add_event("ROBOT_MOVE", f"Robot positioning (Recheck {self.inspection.recheck_count})")
                    await self.robot.move_to(None)
                    self._trigger(Trigger.ARRIVED)
                    
                elif self.inspection.status == State.ACQUIRING:
                    await self._add_event("CAMERA_CAPTURE", "[SIMULATED] Acquiring image")
                    path, img = await self.camera.acquire_image(self.scenario, self.inspection.recheck_count)
                    
                    self._current_image = img
                    self._current_path = path
                    self._trigger(Trigger.CAPTURED)
                    
                elif self.inspection.status == State.ANALYZING:
                    await self._add_event("ANALYSIS_START", "OpenCV analysis running")
                    tmpl = cv2.imread(self.scenario.template_image)
                    if tmpl is None:
                        raise FileNotFoundError(f"Failed to read template: {self.scenario.template_image}")
                    analysis = self.detector.analyze(self._current_image, tmpl)
                    
                    obs = Observation(
                        id=str(uuid.uuid4()),
                        observation_number=self.inspection.recheck_count,
                        camera_position=None,
                        lighting_mode="direct",
                        image_path=self._current_path,
                        image_base64=None,
                        analysis=analysis,
                        timestamp=datetime.utcnow()
                    )
                    self.inspection.observations.append(obs)
                    
                    ev = EvidenceItem(
                        id=str(uuid.uuid4()),
                        source="optical_camera",
                        defect_score=analysis.defect_score,
                        reliability=1.0 if self.inspection.recheck_count == 0 else 0.8,
                        is_simulated=True,
                        observation_id=obs.id,
                        metadata={},
                        timestamp=datetime.utcnow()
                    )
                    self.inspection.evidence_items.append(ev)
                    
                    await self._add_event("ANALYSIS_DONE", f"Defect score: {analysis.defect_score:.3f}")
                    
                    if len(self.inspection.evidence_items) > 1:
                        self.inspection.status = State.FUSING
                    else:
                        self._trigger(Trigger.ANALYZED)
                        
                elif self.inspection.status == State.FUSING:
                    await self._add_event("FUSION", "Fusing multiple evidence items")
                    fusion_result = fuse_evidence(self.inspection.evidence_items)
                    self.inspection.fused_score = fusion_result.fused_defect_score
                    await self._add_event("FUSION_DONE", f"Fused score: {fusion_result.fused_defect_score:.3f}")
                    self._trigger(Trigger.FUSED)

                elif self.inspection.status == State.EVALUATING:
                    await self._add_event("EVALUATING", "Evaluating against thresholds")
                    
                    score = self.inspection.fused_score if self.inspection.fused_score is not None else self.inspection.evidence_items[-1].defect_score
                    is_fused = self.inspection.fused_score is not None
                    
                    result = evaluate_score(score, self.inspection.recheck_count, is_fused)
                    
                    if result == "RECHECK":
                        await self._add_event("AMBIGUOUS", "Evidence ambiguous. Triggering RECHECK.")
                        self.inspection.recheck_count += 1
                        self._trigger(Trigger.AMBIGUOUS)
                        self._trigger(Trigger.PLANNED) # Skip straight to positioning
                    else:
                        self._temp_decision_result = result
                        self._temp_decision_score = score
                        self._trigger(Trigger.CLEAR)
                        
                elif self.inspection.status == State.DECIDING:
                    await self._add_event("DECISION", f"Final decision: {self._temp_decision_result}")
                    
                    confidence = calculate_decision_confidence(self._temp_decision_score, len(self.inspection.evidence_items), 1.0)
                    
                    self.inspection.decision = Decision(
                        result=self._temp_decision_result,
                        defect_score=self._temp_decision_score,
                        decision_confidence=confidence,
                        threshold_used="fused" if self.inspection.fused_score is not None else "primary",
                        observation_count=len(self.inspection.observations),
                        recheck_count=self.inspection.recheck_count,
                        reasoning=[],
                        defect_summary=[],
                        timestamp=datetime.utcnow()
                    )
                    
                    # Generate reasoning
                    explainer = StructuredExplainer(self.inspection)
                    self.inspection.decision.reasoning = explainer.generate_reasoning()
                    
                    self._trigger(Trigger.DECIDED)
                    
                elif self.inspection.status == State.ACTING:
                    await self._add_event("ACTING", "Robot action: " + ("Routing to reject" if self.inspection.decision.result == "FAIL" else "Routing to pass"))
                    await asyncio.sleep(ROBOT_ACTION_DURATION / 1000.0)
                    self._trigger(Trigger.ACTED)

            if self.inspection.status == State.COMPLETE:
                self.inspection.completed_at = datetime.utcnow()
                await self._add_event("COMPLETE", "Inspection complete")
                
                defects_payload = []
                if self.inspection.observations and self.inspection.observations[-1].analysis:
                    for d in self.inspection.observations[-1].analysis.defects:
                        defects_payload.append({
                            "x": d.bbox.x,
                            "y": d.bbox.y,
                            "w": d.bbox.w,
                            "h": d.bbox.h,
                            "severity": d.severity,
                            "type": d.defect_type
                        })

                await manager.broadcast({
                    "type": "inspection_complete",
                    "decision": self.inspection.decision.result,
                    "defect_score": self.inspection.decision.defect_score,
                    "confidence": self.inspection.decision.decision_confidence,
                    "rechecks": self.inspection.recheck_count,
                    "observations": len(self.inspection.observations),
                    "final_image": getattr(self, "_current_path", None),
                    "reasoning": self.inspection.decision.reasoning,
                    "fused_score": self.inspection.fused_score,
                    "defects": defects_payload
                })
        except Exception as e:
            self.inspection.status = State.ERROR
            self.inspection.completed_at = datetime.utcnow()
            await self._add_event("ERROR", f"Inspection failed: {str(e)}")
            await manager.broadcast({
                "type": "error",
                "message": str(e)
            })
