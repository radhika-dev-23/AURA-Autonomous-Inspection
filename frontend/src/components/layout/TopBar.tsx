import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';
import { StatusBadge } from '../common/StatusBadge';
import { useSystemStatus } from '../../hooks/useInspection';

export const TopBar: React.FC = () => {
  const inspectionId = useInspectionStore((s) => s.inspectionId);
  const connected = useInspectionStore((s) => s.connected);
  const state = useInspectionStore((s) => s.state);
  const { data: systemStatus } = useSystemStatus();

  const isLive = state !== 'IDLE' && state !== 'COMPLETE' && state !== 'ERROR';

  return (
    <header className="h-[56px] px-6 border-b border-aura-border bg-aura-bg flex items-center justify-between shrink-0">
      {/* Left: Brand Identity */}
      <div className="flex flex-col">
        <h1 className="text-xl font-black tracking-[4px] text-aura-text leading-none">AURA</h1>
        <span className="text-[9px] font-semibold tracking-[2px] text-aura-text-dim mt-0.5 uppercase">
          AUTONOMOUS INSPECTION INTELLIGENCE
        </span>
      </div>

      {/* Right: Technical Meta Badges */}
      <div className="flex items-center gap-7">
        <div className="flex flex-col items-end">
          <span className="font-mono text-[9px] text-aura-text-muted tracking-wider uppercase">SYSTEM</span>
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-aura-green">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-aura-green animate-pulse' : 'bg-aura-red'}`} />
            <span>{connected ? (systemStatus?.status?.toUpperCase() || 'ONLINE') : 'DISCONNECTED'}</span>
          </div>
        </div>

        <div className="flex flex-col items-end">
          <span className="font-mono text-[9px] text-aura-text-muted tracking-wider uppercase">INSPECTION</span>
          <span className="font-mono text-[11px] font-semibold text-aura-text">#AURA-{inspectionId}</span>
        </div>

        <div className="flex flex-col items-end">
          <span className="font-mono text-[9px] text-aura-text-muted tracking-wider uppercase">MODE</span>
          <StatusBadge status="sim" text={systemStatus?.mode?.toUpperCase() || 'SIMULATION'} />
        </div>

        <div className="flex flex-col items-end">
          <span className="font-mono text-[9px] text-aura-text-muted tracking-wider uppercase">STATUS</span>
          <StatusBadge
            status={isLive ? 'recheck' : 'pass'}
            text={isLive ? 'LIVE' : 'READY'}
          />
        </div>
      </div>
    </header>
  );
};
