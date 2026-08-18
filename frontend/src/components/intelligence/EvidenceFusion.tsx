import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';
import { formatScore } from '../../lib/utils';

export const EvidenceFusion: React.FC = () => {
  const obsScores = useInspectionStore((s) => s.obsScores);
  const fusedScore = useInspectionStore((s) => s.fusedScore);

  if (fusedScore == null && (!obsScores || obsScores.length === 0)) {
    return null;
  }

  const obs1 = obsScores.length > 0 ? obsScores[0] : null;
  const obs2 = obsScores.length > 1 ? obsScores[1] : null;

  return (
    <div className="border border-dashed border-aura-border-hi p-3 flex flex-col gap-2 bg-aura-surface/50">
      <span className="font-mono text-[9px] text-aura-text-muted tracking-widest uppercase">EVIDENCE FUSION</span>

      <div className="flex items-center gap-2 flex-wrap">
        {/* OBS 01 Node */}
        <div className="flex flex-col gap-0.5 border border-aura-border p-2 bg-aura-surface min-w-[72px]">
          <span className="font-mono text-[9px] text-aura-text-muted">OBS 01</span>
          <span className="font-mono text-sm font-bold text-aura-text">{formatScore(obs1)}</span>
          <span className="font-mono text-[8px] text-aura-text-muted">DIRECT VIEW</span>
        </div>

        {/* SVG Connector lines */}
        <div className="text-aura-border-hi shrink-0 flex items-center">
          <svg viewBox="0 0 50 60" className="w-10 h-12">
            <path d="M0 15 Q25 15 25 30" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <path d="M0 45 Q25 45 25 30" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <path d="M25 30 L50 30" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <polygon points="45,26 50,30 45,34" fill="currentColor" />
          </svg>
        </div>

        {/* OBS 02 Node */}
        <div className="flex flex-col gap-0.5 border border-aura-border p-2 bg-aura-surface min-w-[72px]">
          <span className="font-mono text-[9px] text-aura-text-muted">OBS 02</span>
          <span className="font-mono text-sm font-bold text-aura-amber">{formatScore(obs2)}</span>
          <span className="font-mono text-[8px] text-aura-text-muted">CLOSE-UP</span>
        </div>

        {/* Fused Node */}
        <div className="flex flex-col gap-0.5 p-2 border border-aura-cyan/40 bg-aura-cyan/5 ml-auto min-w-[72px]">
          <span className="font-mono text-[9px] text-aura-cyan font-semibold">FUSED</span>
          <span className="font-mono text-base font-extrabold text-aura-cyan">{formatScore(fusedScore)}</span>
        </div>
      </div>
    </div>
  );
};
