import { Scenario } from '../types/scenario';

const API_BASE = '/api';

export async function fetchSystemStatus(): Promise<{ status: string; mode: string }> {
  const res = await fetch(`${API_BASE}/system/status`);
  if (!res.ok) throw new Error('Failed to fetch system status');
  return res.json();
}

export async function fetchScenarios(): Promise<Scenario[]> {
  const res = await fetch(`${API_BASE}/scenarios`);
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  return res.json();
}

export async function startInspection(scenarioId: string): Promise<{ status: string; inspection_id: string }> {
  const res = await fetch(`${API_BASE}/inspection/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario_id: scenarioId }),
  });
  if (!res.ok) throw new Error('Failed to start inspection');
  return res.json();
}
