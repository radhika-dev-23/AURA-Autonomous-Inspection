import json
import os
from typing import List
from .models import Scenario, CameraPosition

def load_scenarios() -> List[Scenario]:
    scenarios = []
    scenarios_dir = "data/scenarios"
    if not os.path.exists(scenarios_dir):
        return []
        
    for filename in os.listdir(scenarios_dir):
        if filename.endswith(".json"):
            with open(os.path.join(scenarios_dir, filename), "r") as f:
                data = json.load(f)
                
                # Convert dicts back to CameraPosition objects
                if "inspection_positions" in data:
                    data["inspection_positions"] = [CameraPosition(**p) for p in data["inspection_positions"]]
                    
                scenarios.append(Scenario(**data))
    return sorted(scenarios, key=lambda s: s.id)

def get_scenario(scenario_id: str) -> Scenario:
    scenarios = load_scenarios()
    for s in scenarios:
        if s.id == scenario_id:
            return s
    raise ValueError(f"Scenario {scenario_id} not found")
