import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';
import { useScenarios, useStartInspection } from '../../hooks/useInspection';
import { StatusBadge } from '../common/StatusBadge';
import { ScenarioMeta } from '../../types/scenario';
import { cn } from '../../lib/utils';
import { Play, RotateCcw } from 'lucide-react';

const SCENARIO_META: Record<string, ScenarioMeta> = {
  clean_board: {
    badge: 'pass',
    badgeText: 'PASS PATH',
    hint: 'Defect-free board. AURA should quickly confirm PASS.',
  },
  obvious_defect: {
    badge: 'fail',
    badgeText: 'FAIL PATH',
    hint: 'Clearly damaged trace. AURA should detect immediately.',
  },
  ambiguous_recheck: {
    badge: 'recheck',
    badgeText: 'RECHECK PATH',
    hint: 'Subtle solder anomaly. AURA must change viewpoint & re-examine.',
  },
};

export const MissionSidebar: React.FC = () => {
  const { data: scenarios = [] } = useScenarios();
  const scenarioId = useInspectionStore((s) => s.scenarioId);
  const selectScenario = useInspectionStore((s) => s.selectScenario);
  const inspRunning = useInspectionStore((s) => s.inspRunning);
  const resetUI = useInspectionStore((s) => s.resetUI);

  const startMutation = useStartInspection();

  const handleStart = () => {
    if (!scenarioId || inspRunning) return;
    startMutation.mutate(scenarioId);
  };

  return (
    <aside className="w-[260px] xl:w-[280px] flex flex-col bg-aura-bg border-r border-aura-border overflow-hidden">
      {/* Panel Header */}
      <div className="px-4 py-2.5 bg-aura-panel border-b border-aura-border flex justify-between items-center shrink-0">
        <h2 className="text-[10px] font-bold tracking-[1.5px] text-aura-text-dim uppercase">
          MISSION CONTROL
        </h2>
      </div>

      {/* Scenario List */}
      <div className="flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto">
        <span className="font-mono text-[9px] text-aura-text-muted tracking-widest uppercase mb-1">
          SCENARIOS
        </span>

        {scenarios.map((s) => {
          const meta = SCENARIO_META[s.id] || { badge: 'pass', badgeText: 'PATH', hint: s.description };
          const isSelected = scenarioId === s.id;

          return (
            <div
              key={s.id}
              onClick={() => selectScenario(s.id)}
              className={cn(
                'border p-3 cursor-pointer transition-all duration-150 bg-aura-panel hover:bg-aura-hover',
                isSelected
                  ? 'border-aura-cyan bg-aura-cyan/5 shadow-[0_0_12px_rgba(0,212,255,0.08)]'
                  : 'border-aura-border hover:border-aura-border-hi'
              )}
            >
              <StatusBadge status={meta.badge} text={meta.badgeText} className="mb-2" />
              <div className="text-[13px] font-bold text-aura-text mb-1">{s.name}</div>
              <div className="text-[11px] text-aura-text-dim leading-snug">{meta.hint}</div>
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="p-3 border-t border-aura-border bg-aura-panel flex gap-2 shrink-0">
        <button
          onClick={handleStart}
          disabled={!scenarioId || inspRunning}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 font-mono text-[11px] font-bold tracking-wider transition-all border border-transparent',
            !scenarioId || inspRunning
              ? 'bg-aura-border text-aura-text-muted cursor-not-allowed opacity-50'
              : 'bg-aura-cyan text-black hover:bg-[#00B8D9] cursor-pointer'
          )}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{inspRunning ? 'RUNNING...' : 'START INSPECTION'}</span>
        </button>

        <button
          onClick={() => resetUI(true)}
          className="flex items-center justify-center p-2.5 border border-aura-border bg-transparent text-aura-text-dim hover:text-aura-text hover:border-aura-border-hi transition-colors cursor-pointer"
          title="Reset System"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
};
