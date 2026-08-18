import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';
import { SignalClarity } from './SignalClarity';
import { EvidenceFusion } from './EvidenceFusion';
import { FinalDecision } from './FinalDecision';
import { ExplanationPanel } from './ExplanationPanel';
import { DefectDetailPanel } from './DefectDetailPanel';
import { StatusBadge } from '../common/StatusBadge';
import { cn } from '../../lib/utils';

export const DecisionPanel: React.FC = () => {
  const state = useInspectionStore((s) => s.state);
  const rechecks = useInspectionStore((s) => s.rechecks);
  const defects = useInspectionStore((s) => s.defects);
  const selectedDefectIndex = useInspectionStore((s) => s.selectedDefectIndex);
  const isFocusMode = useInspectionStore((s) => s.isFocusMode);
  const selectDefect = useInspectionStore((s) => s.selectDefect);
  const setFocusMode = useInspectionStore((s) => s.setFocusMode);

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
        {defects.length > 0 && (
          <span className="font-mono text-[9px] text-aura-amber font-semibold">
            {defects.length} ANOMALIES
          </span>
        )}
      </div>

      {/* Panel Body */}
      <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
        {/* FSM State Indicator */}
        <div className="py-0.5">
          <div className={cn('font-mono text-2xl font-black tracking-wider uppercase transition-colors duration-300', getStateColor())}>
            {displayState}
          </div>
        </div>

        {/* Defect Detail Magnified Panel (when focus mode or defect selected) */}
        {isFocusMode && selectedDefectIndex !== null ? (
          <DefectDetailPanel />
        ) : (
          <>
            {/* Signal Clarity Metrics */}
            <SignalClarity />

            {/* Compact Detected Anomalies Selection List */}
            {defects.length > 0 && (
              <div className="flex flex-col gap-1.5 border border-aura-border p-2.5 bg-aura-panel">
                <span className="font-mono text-[9px] text-aura-text-muted tracking-widest uppercase mb-1">
                  DETECTED ANOMALIES ({defects.length})
                </span>
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                  {defects.map((d, idx) => {
                    const isSelected = selectedDefectIndex === idx;
                    const isFail = d.severity === 'CRITICAL' || d.severity === 'HIGH';

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          selectDefect(idx);
                          setFocusMode(true);
                        }}
                        className={cn(
                          'flex items-center justify-between p-1.5 border font-mono text-[10px] cursor-pointer transition-all',
                          isSelected
                            ? 'border-aura-cyan bg-aura-cyan/10 font-bold'
                            : 'border-aura-border hover:border-aura-border-hi bg-aura-surface'
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-aura-text-muted text-[9px]">0{idx + 1}</span>
                          <span className="text-aura-text truncate">{d.defect_type.replace(/_/g, ' ')}</span>
                        </div>
                        <StatusBadge status={isFail ? 'fail' : 'recheck'} text={d.severity} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

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
