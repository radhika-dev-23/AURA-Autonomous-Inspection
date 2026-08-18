import { create } from 'zustand';
import { InspectionState, Defect, TimelineItem, DecisionType } from '../types/inspection';
import { Scenario } from '../types/scenario';
import { WSStateUpdate, WSInspectionComplete } from '../types/websocket';

interface InspectionStore {
  inspectionId: string;
  scenarioId: string | null;
  scenarios: Scenario[];
  state: InspectionState;
  rechecks: number;
  currentImagePath: string | null;
  currentScore: number | null;
  confidence: number | null;
  fusedScore: number | null;
  defects: Defect[];
  obsScores: number[];
  timeline: TimelineItem[];
  decision: DecisionType | null;
  decisionAction: string | null;
  reasoning: string[];
  viewMode: 'real' | 'diff' | 'heatmap';
  inspRunning: boolean;
  connected: boolean;

  // Defect Focus Selection State
  selectedDefectIndex: number | null;
  isFocusMode: boolean;

  // Actions
  setScenarios: (scenarios: Scenario[]) => void;
  selectScenario: (id: string) => void;
  setViewMode: (mode: 'real' | 'diff' | 'heatmap') => void;
  setConnected: (connected: boolean) => void;
  setInspRunning: (running: boolean) => void;
  handleStateUpdate: (update: WSStateUpdate) => void;
  handleInspectionComplete: (complete: WSInspectionComplete) => void;
  handleError: (msg: string) => void;
  resetUI: (full?: boolean) => void;

  // Focus Mode Actions
  selectDefect: (index: number | null) => void;
  setFocusMode: (focus: boolean) => void;
  nextDefect: () => void;
  prevDefect: () => void;
  returnToOverview: () => void;
}

const generateInspId = () => Math.floor(Math.random() * 9000 + 1000).toString();

export const useInspectionStore = create<InspectionStore>((set, get) => ({
  inspectionId: generateInspId(),
  scenarioId: null,
  scenarios: [],
  state: 'IDLE',
  rechecks: 0,
  currentImagePath: null,
  currentScore: null,
  confidence: null,
  fusedScore: null,
  defects: [],
  obsScores: [],
  timeline: [],
  decision: null,
  decisionAction: null,
  reasoning: ['System idle. Select a scenario and start inspection.'],
  viewMode: 'real',
  inspRunning: false,
  connected: false,

  selectedDefectIndex: null,
  isFocusMode: false,

  setScenarios: (scenarios) => set({ scenarios }),

  selectScenario: (id) => {
    if (get().inspRunning) return;
    set({ scenarioId: id });
  },

  setViewMode: (viewMode) => set({ viewMode }),

  setConnected: (connected) => set({ connected }),

  setInspRunning: (inspRunning) => set({ inspRunning }),

  handleStateUpdate: (update) => {
    set((store) => {
      const defects = update.defects && update.defects.length > 0 ? update.defects : store.defects;
      const obsScores = update.obs_scores && update.obs_scores.length > 0 ? update.obs_scores : store.obsScores;
      const timeline = update.timeline || store.timeline;

      // Auto select primary defect if defects arrive and none selected yet
      let selectedDefectIndex = store.selectedDefectIndex;
      if (defects.length > 0 && selectedDefectIndex == null) {
        selectedDefectIndex = 0;
      }

      return {
        state: update.state,
        rechecks: update.rechecks,
        currentImagePath: update.current_image_path || store.currentImagePath,
        currentScore: update.current_score !== undefined ? update.current_score : store.currentScore,
        confidence: update.confidence !== undefined ? update.confidence : store.confidence,
        fusedScore: update.fused_score !== undefined ? update.fused_score : store.fusedScore,
        defects,
        obsScores,
        timeline,
        selectedDefectIndex,
      };
    });
  },

  handleInspectionComplete: (complete) => {
    const decisionAction = complete.decision === 'FAIL' ? '→ ROUTE TO REJECT BIN' : '→ RELEASE TO PRODUCTION';
    const defects = complete.defects || get().defects;
    const selectedDefectIndex = defects.length > 0 ? 0 : null;

    set({
      inspRunning: false,
      state: 'COMPLETE',
      decision: complete.decision,
      decisionAction,
      currentScore: complete.defect_score !== undefined ? complete.defect_score : get().currentScore,
      confidence: complete.confidence !== undefined ? complete.confidence : get().confidence,
      fusedScore: complete.fused_score !== undefined ? complete.fused_score : get().fusedScore,
      defects,
      currentImagePath: complete.final_image || get().currentImagePath,
      reasoning: complete.reasoning && complete.reasoning.length > 0 ? complete.reasoning : get().reasoning,
      selectedDefectIndex,
    });
  },

  handleError: (msg) => {
    set({
      inspRunning: false,
      state: 'ERROR',
      reasoning: [`Error: ${msg}`],
    });
  },

  resetUI: (full = false) => {
    set({
      state: 'IDLE',
      rechecks: 0,
      currentImagePath: null,
      currentScore: null,
      confidence: null,
      fusedScore: null,
      defects: [],
      obsScores: [],
      timeline: [],
      decision: null,
      decisionAction: null,
      reasoning: ['System idle. Select a scenario and start inspection.'],
      viewMode: 'real',
      inspRunning: false,
      selectedDefectIndex: null,
      isFocusMode: false,
      scenarioId: full ? null : get().scenarioId,
    });
  },

  selectDefect: (index) => {
    set({ selectedDefectIndex: index });
  },

  setFocusMode: (isFocusMode) => {
    set({ isFocusMode });
  },

  nextDefect: () => {
    const { defects, selectedDefectIndex } = get();
    if (!defects.length) return;
    const nextIdx = (selectedDefectIndex === null ? 0 : selectedDefectIndex + 1) % defects.length;
    set({ selectedDefectIndex: nextIdx, isFocusMode: true });
  },

  prevDefect: () => {
    const { defects, selectedDefectIndex } = get();
    if (!defects.length) return;
    const prevIdx = selectedDefectIndex === null || selectedDefectIndex === 0 ? defects.length - 1 : selectedDefectIndex - 1;
    set({ selectedDefectIndex: prevIdx, isFocusMode: true });
  },

  returnToOverview: () => {
    set({ isFocusMode: false });
  },
}));
