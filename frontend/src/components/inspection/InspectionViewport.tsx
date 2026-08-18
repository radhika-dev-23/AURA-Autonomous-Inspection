import React from 'react';
import { PCBScene } from './PCBScene';
import { useInspectionStore } from '../../store/inspectionStore';
import { TechnicalLabel } from '../common/TechnicalLabel';
import { cn } from '../../lib/utils';

export const InspectionViewport: React.FC = () => {
  const state = useInspectionStore((s) => s.state);
  const rechecks = useInspectionStore((s) => s.rechecks);
  const viewMode = useInspectionStore((s) => s.viewMode);
  const setViewMode = useInspectionStore((s) => s.setViewMode);

  const isRecheck = rechecks > 0;
  const isScanning = state === 'ACQUIRING' || state === 'ANALYZING';

  // Telemetry details based on state
  const robotPos = isRecheck ? 'X:160  Y:105  Z:150 mm' : 'X:150  Y:100  Z:300 mm';
  const camAngle = isRecheck ? '35° ANGLED' : '0° DIRECT';
  const lightMode = isRecheck ? 'ANGLED' : 'DIRECT';
  const actionText = isRecheck && state === 'POSITIONING' ? 'CHANGING VIEWPOINT' : state;

  return (
    <section className="flex flex-col flex-1 bg-black relative overflow-hidden border border-aura-border">
      {/* Viewport Header */}
      <div className="flex justify-between items-center px-4 py-2 bg-aura-panel border-b border-aura-border z-10">
        <h2 className="text-[10px] font-bold tracking-[1.5px] text-aura-text-dim uppercase">
          DIGITAL INSPECTION CELL
        </h2>

        {/* View Toggle */}
        <div className="flex rounded overflow-hidden border border-aura-border">
          <button
            onClick={() => setViewMode('real')}
            className={cn(
              'px-2.5 py-1 font-mono text-[9px] font-semibold tracking-wider transition-colors',
              viewMode === 'real'
                ? 'bg-aura-cyan text-black border-aura-cyan'
                : 'bg-transparent text-aura-text-muted hover:text-aura-text'
            )}
          >
            REAL VIEW
          </button>
          <button
            onClick={() => setViewMode('diff')}
            className={cn(
              'px-2.5 py-1 font-mono text-[9px] font-semibold tracking-wider border-l border-aura-border transition-colors',
              viewMode === 'diff'
                ? 'bg-aura-cyan text-black border-aura-cyan'
                : 'bg-transparent text-aura-text-muted hover:text-aura-text'
            )}
          >
            DIFFERENCE
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            className={cn(
              'px-2.5 py-1 font-mono text-[9px] font-semibold tracking-wider border-l border-aura-border transition-colors',
              viewMode === 'heatmap'
                ? 'bg-aura-cyan text-black border-aura-cyan'
                : 'bg-transparent text-aura-text-muted hover:text-aura-text'
            )}
          >
            ANOMALY MAP
          </button>
        </div>
      </div>

      {/* Main 3D Scene Viewport */}
      <div className="relative flex-1 w-full h-full bg-black">
        <PCBScene />

        {/* Crosshair Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-15 z-10">
          <div className="absolute top-1/2 left-0 w-full h-px bg-aura-cyan" />
          <div className="absolute top-0 left-1/2 h-full w-px bg-aura-cyan" />
        </div>

        {/* Scanning Line Animation */}
        {isScanning && (
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-aura-cyan to-transparent opacity-65 animate-scan pointer-events-none z-10" />
        )}

        {/* Top-Left Telemetry Overlay */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 bg-aura-bg/90 border border-aura-border p-2.5 backdrop-blur-sm pointer-events-none">
          <TechnicalLabel label="[VIRTUAL ROBOT]" value={robotPos} />
          <TechnicalLabel label="[VIRTUAL CAMERA]" value={camAngle} />
          <TechnicalLabel label="LIGHTING" value={lightMode} />
          <TechnicalLabel label="ACTION" value={actionText} accent />
        </div>

        {/* RECHECK ACTIVE Hero Overlay Banner */}
        {isRecheck && (state === 'POSITIONING' || state === 'ACQUIRING' || state === 'ANALYZING') && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-aura-amber/10 border border-aura-amber px-3 py-1.5 backdrop-blur-md animate-pulse-subtle">
            <span className="w-2 h-2 rounded-full bg-aura-amber" />
            <span className="font-mono text-[10px] font-bold text-aura-amber tracking-widest uppercase">
              RECHECK REQUIRED — VIEWPOINT CHANGING
            </span>
          </div>
        )}

        {/* Bottom-Right Camera Label */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end font-mono text-[9px] text-aura-text-muted bg-aura-bg/85 border border-aura-border px-2.5 py-1 backdrop-blur-sm pointer-events-none">
          <span className="text-aura-text font-bold">{isRecheck ? 'CAMERA 02' : 'CAMERA 01'}</span>
          <span>{isRecheck ? 'CLOSE-UP · 35° ANGLED' : 'DIRECT VIEW'}</span>
        </div>
      </div>
    </section>
  );
};
