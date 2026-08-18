import asyncio
import os
import sys
from backend.scenarios import get_scenario
from backend.inspection_engine import InspectionEngine
from backend.models import State

async def test_scenario(scenario_id: str, expected_result: str):
    print(f"\n==============================================")
    print(f"Testing Scenario: {scenario_id}")
    print(f"Expected Result: {expected_result}")
    print(f"==============================================")
    
    scenario = get_scenario(scenario_id)
    engine = InspectionEngine(scenario)
    
    # We override the broadcast to just print the states
    async def mock_broadcast(msg):
        if msg.get("type") == "state_update":
            state = msg.get("state")
            rechecks = msg.get("rechecks")
            print(f"[STATE] -> {state} (Rechecks: {rechecks})")
            
            # Print the latest timeline event
            if msg.get("timeline"):
                latest = msg["timeline"][-1]
                print(f"  Event: [{latest['event']}] {latest['desc']}")
        elif msg.get("type") == "inspection_complete":
            print("\n>>> INSPECTION COMPLETE EVENT EMITTED <<<")
            print(f"    Decision: {msg['decision']}")
            print(f"    Confidence: {msg['confidence']:.2f}")
            print(f"    Score: {msg['defect_score']:.3f}")
            print(f"    Rechecks: {msg['rechecks']}")
    
    from backend.ws_manager import manager
    manager.broadcast = mock_broadcast
    
    await engine.run()
    
    assert engine.inspection.status == State.COMPLETE
    assert engine.inspection.decision.result == expected_result
    
    print("\n--- REASONING ---")
    for r in engine.inspection.decision.reasoning:
        print(f"> {r}")
        
    print(f"\nSUCCESS: {scenario_id} passed expectations.")

async def main():
    try:
        await test_scenario("clean_board", "PASS")
        await test_scenario("obvious_defect", "FAIL")
        await test_scenario("ambiguous_recheck", "FAIL") # Fused score causes FAIL
        print("\nALL SCENARIOS PASSED E2E VERIFICATION!")
    except AssertionError as e:
        print(f"\nTEST FAILED: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
