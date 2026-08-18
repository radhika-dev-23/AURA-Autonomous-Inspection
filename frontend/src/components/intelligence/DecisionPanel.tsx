import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';
import { SignalClarity } from './SignalClarity';
import { EvidenceFusion } from './EvidenceFusion';
import { FinalDecision } from './FinalDecision';
import { ExplanationPanel } from './ExplanationPanel';
import { cn } from '../../lib/utils';

export const DecisionPanel: React.FC = () => {
  const state = useInspectionStore((s) => s.state);
  const rechecks = useInspectionStore((s) => s.rechecks);

  const displayState = rechecks > 0 && state === 'POSITIONING' ? 'RECHECK REQUIRED' : state;

  const getStateColor = () => {
    switch (state) {
      case 'ANALYZING':
        return 'text-aura-cyan';
      case 'POSITIONING':
        return rechecks > 0 ? 'text-aura-amber animate-pulse-subtle' : 'text-aura-text-dim';
      case 'RECHECKING':
      case 'EVALUATING':
      case 'FUSING':
        return 'text-aura-amber';
      case 'COMPLETE':
        return 'text-aura-text';
      case 'ERROR':
        return 'text-aura-red';
      default:
        return 'text-aura-text-muted';
    }
  };

  return (
    <aside className="w-[320px] xl:w-[340px] flex flex-col bg-aura-bg border-l border-aura-border overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-2.5 bg-aura-panel border-b border-aura-border flex justify-between items-center shrink-0">
        <h2 className="text-[10px] font-bold tracking-[1.5px] text-aura-text-dim uppercase">
          DECISION INTELLIGENCE
        </h2>
      </div>

      {/* Panel Body */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
        {/* FSM State Indicator */}
        <div className="py-1">
          <div className={cn('font-mono text-2xl font-black tracking-wider uppercase transition-colors duration-300', getStateColor())}>
            {displayState}
          </div>
        </div>

        {/* Signal Clarity Metrics */}
        <SignalClarity />

        {/* Evidence Fusion Block */}
        <EvidenceFusion />

        {/* Final Decision Card */}
        <FinalDecision />

        {/* AI Explanation List */}
        <ExplanationPanel />
      </div>
    </aside>
  );
};
