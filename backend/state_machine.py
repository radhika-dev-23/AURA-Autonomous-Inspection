from enum import Enum
from .models import State

class Trigger(str, Enum):
    START = "START"
    ARRIVED = "ARRIVED"
    CAPTURED = "CAPTURED"
    ANALYZED = "ANALYZED"
    CLEAR = "CLEAR"
    AMBIGUOUS = "AMBIGUOUS"
    MAX_RECHECK = "MAX_RECHECK"
    PLANNED = "PLANNED"
    FUSED = "FUSED"
    DECIDED = "DECIDED"
    ACTED = "ACTED"
    RESET = "RESET"

class StateMachine:
    def __init__(self):
        self.transitions = {
            (State.IDLE, Trigger.START):            State.POSITIONING,
            (State.POSITIONING, Trigger.ARRIVED):   State.ACQUIRING,
            (State.ACQUIRING, Trigger.CAPTURED):    State.ANALYZING,
            (State.ANALYZING, Trigger.ANALYZED):    State.EVALUATING,  # or FUSING via engine logic
            (State.EVALUATING, Trigger.CLEAR):      State.DECIDING,
            (State.EVALUATING, Trigger.AMBIGUOUS):  State.RECHECKING,
            (State.EVALUATING, Trigger.MAX_RECHECK):State.DECIDING,
            (State.RECHECKING, Trigger.PLANNED):    State.POSITIONING,
            (State.FUSING, Trigger.FUSED):          State.EVALUATING,
            (State.DECIDING, Trigger.DECIDED):      State.ACTING,
            (State.ACTING, Trigger.ACTED):          State.COMPLETE,
            (State.COMPLETE, Trigger.RESET):        State.IDLE,
            (State.ERROR, Trigger.RESET):           State.IDLE,
        }

    def next_state(self, current_state: State, trigger: Trigger) -> State:
        return self.transitions.get((current_state, trigger), State.ERROR)
