import { InspectionState, Defect, TimelineItem } from './inspection';

export interface WSStateUpdate {
  type: 'state_update';
  state: InspectionState;
  scenario?: string;
  rechecks: number;
  current_image_path?: string | null;
  current_score?: number | null;
  confidence?: number | null;
  fused_score?: number | null;
  defects?: Defect[];
  obs_scores?: number[];
  timeline?: TimelineItem[];
}

export interface WSInspectionComplete {
  type: 'inspection_complete';
  decision: 'PASS' | 'FAIL';
  defect_score?: number;
  confidence?: number;
  rechecks: number;
  observations?: number;
  final_image?: string | null;
  reasoning?: string[];
  fused_score?: number | null;
  defects?: Defect[];
}

export interface WSError {
  type: 'error';
  message: string;
}

export type WSMessage = WSStateUpdate | WSInspectionComplete | WSError;
