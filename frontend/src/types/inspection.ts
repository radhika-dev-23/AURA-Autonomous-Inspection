export type InspectionState =
  | 'IDLE'
  | 'POSITIONING'
  | 'ACQUIRING'
  | 'ANALYZING'
  | 'EVALUATING'
  | 'RECHECKING'
  | 'FUSING'
  | 'DECIDING'
  | 'ACTING'
  | 'COMPLETE'
  | 'ERROR';

export type DecisionType = 'PASS' | 'FAIL' | 'RECHECK' | 'AMBIGUOUS';

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Defect {
  bbox: BBox;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  defect_type: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  type?: string;
}

export interface CameraPosition {
  x: number;
  y: number;
  z: number;
  angle_deg: number;
  zoom: number;
  label: string;
}

export interface TimelineItem {
  time: string;
  state: string;
  event: string;
  desc: string;
}

export interface InspectionData {
  inspection_id?: string;
  state: InspectionState;
  scenario?: string;
  rechecks: number;
  current_image_path?: string | null;
  current_score?: number | null;
  confidence?: number | null;
  fused_score?: number | null;
  defects: Defect[];
  obs_scores: number[];
  timeline: TimelineItem[];
  decision?: DecisionType | null;
  reasoning?: string[];
  final_image?: string | null;
}
