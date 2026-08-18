import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .ws_manager import manager
from .scenarios import load_scenarios, get_scenario
from .inspection_engine import InspectionEngine

app = FastAPI(title="AURA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class StartRequest(BaseModel):
    scenario_id: str

@app.get("/api/system/status")
def get_status():
    return {"status": "online", "mode": "simulated"}

@app.get("/api/scenarios")
def get_scenarios():
    scenarios = load_scenarios()
    return [{"id": s.id, "name": s.name, "description": s.description} for s in scenarios]

active_inspection_task = None

@app.post("/api/inspection/start")
async def start_inspection(req: StartRequest):
    global active_inspection_task
    if active_inspection_task and not active_inspection_task.done():
        from fastapi import HTTPException
        raise HTTPException(status_code=409, detail="An inspection is already running.")
        
    scenario = get_scenario(req.scenario_id)
    engine = InspectionEngine(scenario)
    
    active_inspection_task = asyncio.create_task(engine.run())
    
    return {"status": "started", "inspection_id": engine.inspection.id}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            _ = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

import os
if os.path.exists("frontend"):
    app.mount("/data", StaticFiles(directory="data"), name="data")
    app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
