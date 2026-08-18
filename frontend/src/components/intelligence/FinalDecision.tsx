import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';
import { cn } from '../../lib/utils';

export const FinalDecision: React.FC = () => {
  const decision = useInspectionStore((s) => s.decision);
  const decisionAction = useInspectionStore((s) => s.decisionAction);
  const state = useInspectionStore((s) => s.state);

  if (!decision && state !== 'COMPLETE') {
    return null;
  }

  const isPass = decision === 'PASS';
  const isFail = decision === 'FAIL';

  return (
    <div
      className={cn(
        'border p-3 flex flex-col gap-1 transition-all duration-300',
        isPass && 'border-aura-green bg-aura-green/5',
        isFail && 'border-aura-red bg-aura-red/5',
        !isPass && !isFail && 'border-aura-border bg-aura-panel'
      )}
    >
      <span className="font-mono text-[9px] text-aura-text-muted tracking-widest uppercase">FINAL DECISION</span>

      <div
        className={cn(
          'text-2xl font-black tracking-widest font-sans uppercase',
          isPass && 'text-aura-green',
          isFail && 'text-aura-red',
          !isPass && !isFail && 'text-aura-text'
        )}
      >
        {decision || '—'}
      </div>

      <div
        className={cn(
          'font-mono text-[10px] font-bold tracking-wider',
          isPass && 'text-aura-green',
          isFail && 'text-aura-red',
          !isPass && !isFail && 'text-aura-text-dim'
        )}
      >
        {decisionAction || '—'}
      </div>
    </div>
  );
};
