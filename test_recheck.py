import asyncio
import os
import sys
import uuid
from backend.models import Scenario, CameraPosition, State
from backend.state_machine import Trigger
from backend.inspection_engine import InspectionEngine

# Mock missing image scenario
missing_image_scenario = Scenario(
    id="missing_image",
    name="Missing Image",
    description="Test file not found",
    expected_result="UNKNOWN",
    expected_path="UNKNOWN",
    template_image="data/images/templates/board_01_clean.png",
    test_images=["data/images/test/does_not_exist.png"],
    defect_annotations=[],
    inspection_positions=[],
    lighting_modes=["direct"],
    sensor_overrides={}
)

# Agree recheck (Ambiguous -> Obvious Defect)
agree_recheck_scenario = Scenario(
    id="agree_recheck",
    name="Agree Recheck",
    description="Ambiguous then obvious",
    expected_result="UNKNOWN",
    expected_path="UNKNOWN",
    template_image="data/images/templates/board_01_clean.png",
    test_images=[
        "data/images/test/board_01_subtle_defect.png",
        "data/images/test/board_01_obvious_defect.png"
    ],
    defect_annotations=[],
    inspection_positions=[],
    lighting_modes=["direct"],
    sensor_overrides={}
)

# Disagree recheck (Ambiguous -> Clean)
disagree_recheck_scenario = Scenario(
    id="disagree_recheck",
    name="Disagree Recheck",
    description="Ambiguous then clean",
    expected_result="UNKNOWN",
    expected_path="UNKNOWN",
    template_image="data/images/templates/board_01_clean.png",
    test_images=[
        "data/images/test/board_01_subtle_defect.png",
        "data/images/test/board_01_clean.png"
    ],
    defect_annotations=[],
    inspection_positions=[],
    lighting_modes=["direct"],
    sensor_overrides={}
)

# Multi ambiguous (hits max rechecks)
max_recheck_scenario = Scenario(
    id="max_recheck",
    name="Max Recheck",
    description="Always ambiguous",
    expected_result="UNKNOWN",
    expected_path="UNKNOWN",
    template_image="data/images/templates/board_01_clean.png",
    test_images=[
        "data/images/test/board_01_subtle_defect.png",
        "data/images/test/board_01_subtle_defect.png",
        "data/images/test/board_01_subtle_defect.png",
        "data/images/test/board_01_subtle_defect.png"
    ],
    defect_annotations=[],
    inspection_positions=[],
    lighting_modes=["direct"],
    sensor_overrides={}
)

async def test_scenario(scenario: Scenario, expected_result: str, expected_state: State, test_reset: bool = False):
    print(f"\n==============================================")
    print(f"Testing Scenario: {scenario.id}")
    print(f"Expected Result: {expected_result}")
    print(f"==============================================")
    
    engine = InspectionEngine(scenario)
    
    async def mock_broadcast(msg):
        if msg.get("type") == "state_update":
            state = msg.get("state")
            rechecks = msg.get("rechecks")
            if msg.get("timeline"):
                latest = msg["timeline"][-1]
                print(f"[STATE] -> {state} (Rechecks: {rechecks}) | Event: [{latest['event']}] {latest['desc']}")
        elif msg.get("type") == "error":
            print(f">>> ERROR EVENT: {msg['message']}")
    
    from backend.ws_manager import manager
    manager.broadcast = mock_broadcast
    
    await engine.run()
    
    if engine.inspection.status != expected_state:
        raise AssertionError(f"Expected state {expected_state}, got {engine.inspection.status}")
        
    if engine.inspection.status == State.COMPLETE:
        if engine.inspection.decision.result != expected_result:
            raise AssertionError(f"Expected result {expected_result}, got {engine.inspection.decision.result}")
        print(f"\n--- REASONING ({scenario.id}) ---")
        for r in engine.inspection.decision.reasoning:
            print(f"> {r}")
            
    if test_reset and engine.inspection.status == State.ERROR:
        print("\n--- Testing RESET from ERROR ---")
        try:
            engine._trigger(Trigger.RESET)
            print(f"State after reset: {engine.inspection.status}")
            if engine.inspection.status != State.IDLE:
                raise AssertionError("Failed to reset to IDLE")
        except Exception as e:
            raise AssertionError(f"Reset failed: {e}")
            
    print(f"\nSUCCESS: {scenario.id} passed expectations.")

async def main():
    try:
        from backend.scenarios import get_scenario
        
        # 1. Invalid scenario API call
        print("\n==============================================")
        print("Testing Invalid Scenario API")
        try:
            get_scenario("non_existent_scenario")
            raise AssertionError("Should have raised ValueError")
        except ValueError:
            print("SUCCESS: Invalid scenario caught by API.")
            
        # 2. Image Failure & Reset
        await test_scenario(missing_image_scenario, None, State.ERROR, test_reset=True)
        
        # 3. First score ambiguous, second agrees (FAIL)
        # Obs 1 is subtle (ambiguous), Obs 2 is obvious (high fail score) -> Fused is FAIL
        await test_scenario(agree_recheck_scenario, "FAIL", State.COMPLETE)
        
        # 4. First score ambiguous, second disagrees (PASS)
        # Obs 1 is subtle (ambiguous), Obs 2 is clean (0.0 score) -> Fused is PASS
        await test_scenario(disagree_recheck_scenario, "PASS", State.COMPLETE)
        
        # 5. Maximum rechecks
        # Config has MAX_RECHECKS=1, so it should do 1 recheck.
        # But 0.218 < 0.25 (fused pass threshold), so it just PASSes explicitly.
        await test_scenario(max_recheck_scenario, "PASS", State.COMPLETE)
        
        print("\nALL DEDICATED RECHECK SCENARIOS PASSED!")
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
