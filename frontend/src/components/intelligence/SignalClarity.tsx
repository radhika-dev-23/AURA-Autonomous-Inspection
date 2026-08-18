import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';
import { formatScore, formatPercentage } from '../../lib/utils';

export const SignalClarity: React.FC = () => {
  const currentScore = useInspectionStore((s) => s.currentScore);
  const confidence = useInspectionStore((s) => s.confidence);

  // Score color logic
  const getScoreColor = (s: number | null) => {
    if (s == null) return 'text-aura-text';
    if (s < 0.3) return 'text-aura-green';
    if (s < 0.7) return 'text-aura-amber';
    return 'text-aura-red';
  };

  const needleLeft = currentScore != null ? `${(Math.min(Math.max(currentScore, 0), 1) * 100).toFixed(1)}%` : '0%';
  const confWidth = confidence != null ? `${(Math.min(Math.max(confidence, 0), 1) * 100).toFixed(1)}%` : '0%';

  return (
    <div className="flex flex-col gap-3">
      {/* Defect Score Metric */}
      <div className="p-3 border border-aura-border bg-aura-panel flex flex-col">
        <span className="font-mono text-[9px] text-aura-text-dim tracking-wider uppercase">DEFECT SCORE</span>
        <span className="text-[9px] text-aura-text-muted mb-1">heuristic anomaly strength</span>
        <span className={`font-mono text-2xl font-extrabold mb-2 ${getScoreColor(currentScore)}`}>
          {formatScore(currentScore)}
        </span>

        {/* Score Gauge Track */}
        <div className="relative mt-1">
          <div className="flex h-1.5 overflow-hidden w-full">
            <div className="w-[30%] h-full bg-aura-green/30" />
            <div className="w-[40%] h-full bg-aura-amber/30" />
            <div className="w-[30%] h-full bg-aura-red/30" />
          </div>
          {/* Gauge Needle */}
          <div
            className="absolute -top-1 w-0.5 h-3.5 bg-aura-text transition-all duration-300 ease-out"
            style={{ left: needleLeft }}
          />
          <div className="flex justify-between font-mono text-[8px] text-aura-text-muted mt-1">
            <span>0.0</span>
            <span className="text-aura-green font-semibold">PASS</span>
            <span className="text-aura-amber font-semibold">RECHECK</span>
            <span className="text-aura-red font-semibold">FAIL</span>
            <span>1.0</span>
          </div>
        </div>
      </div>

      {/* Decision Confidence Metric */}
      <div className="p-3 border border-aura-border bg-aura-panel flex flex-col">
        <span className="font-mono text-[9px] text-aura-text-dim tracking-wider uppercase">DECISION CONFIDENCE</span>
        <span className="text-[9px] text-aura-text-muted mb-1">clarity of signal</span>
        <span className="font-mono text-2xl font-extrabold text-aura-text mb-2">
          {formatPercentage(confidence)}
        </span>
        <div className="h-1.5 bg-aura-border w-full overflow-hidden">
          <div
            className="h-full bg-aura-cyan transition-all duration-300 ease-out"
            style={{ width: confWidth }}
          />
        </div>
      </div>
    </div>
  );
};
