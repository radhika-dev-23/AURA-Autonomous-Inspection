import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';
import { DefectCropCanvas } from './DefectCropCanvas';
import { StatusBadge } from '../common/StatusBadge';
import { TechnicalLabel } from '../common/TechnicalLabel';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

export const DefectDetailPanel: React.FC = () => {
  const defects = useInspectionStore((s) => s.defects);
  const selectedDefectIndex = useInspectionStore((s) => s.selectedDefectIndex);
  const currentImagePath = useInspectionStore((s) => s.currentImagePath);
  const rechecks = useInspectionStore((s) => s.rechecks);

  const nextDefect = useInspectionStore((s) => s.nextDefect);
  const prevDefect = useInspectionStore((s) => s.prevDefect);
  const returnToOverview = useInspectionStore((s) => s.returnToOverview);

  if (selectedDefectIndex === null || !defects || defects.length === 0 || !defects[selectedDefectIndex]) {
    return null;
  }

  const defect = defects[selectedDefectIndex];
  const bbox = defect.bbox;
  const isFail = defect.severity === 'CRITICAL' || defect.severity === 'HIGH';

  const obsLabel = rechecks > 0 ? 'OBSERVATION 02 · CLOSE-UP (35°)' : 'OBSERVATION 01 · DIRECT VIEW';

  return (
    <div className="flex flex-col gap-3 p-3 border border-aura-border bg-aura-panel animate-pulse-subtle">
      {/* Precision Focus Header */}
      <div className="flex justify-between items-center border-b border-aura-border pb-2">
        <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-aura-amber tracking-widest uppercase">
          <span className="w-2 h-2 rounded-full bg-aura-amber animate-pulse" />
          <span>PRECISION INSPECTION</span>
        </div>
        <button
          onClick={returnToOverview}
          className="flex items-center gap-1 font-mono text-[9px] text-aura-text-muted hover:text-aura-cyan transition-colors cursor-pointer"
        >
          <Maximize2 className="w-3 h-3" />
          <span>OVERVIEW</span>
        </button>
      </div>

      {/* Magnified 2D Real Image Crop Canvas */}
      <DefectCropCanvas
        imagePath={currentImagePath}
        bbox={bbox}
        severity={defect.severity}
        defectType={defect.defect_type}
      />

      {/* Defect Metadata */}
      <div className="flex justify-between items-start pt-1">
        <div className="flex flex-col">
          <span className="font-mono text-[9px] text-aura-text-muted uppercase">DEFECT TYPE</span>
          <span className="font-mono text-sm font-bold text-aura-text uppercase">
            {defect.defect_type.replace(/_/g, ' ')}
          </span>
        </div>
        <StatusBadge status={isFail ? 'fail' : 'recheck'} text={defect.severity} />
      </div>

      {/* Coordinates & Technical Specs */}
      <div className="grid grid-cols-2 gap-2 p-2 bg-aura-surface border border-aura-border text-[10px]">
        <TechnicalLabel label="BBOX COORDS" value={`X:${bbox.x} Y:${bbox.y}`} />
        <TechnicalLabel label="DIMENSIONS" value={`${bbox.w}×${bbox.h} px`} />
        <TechnicalLabel label="OBSERVATION" value={obsLabel} accent />
        <TechnicalLabel label="AREA" value={`${bbox.w * bbox.h} px²`} />
      </div>

      {/* Defect Navigation Controls */}
      <div className="flex items-center justify-between pt-1 border-t border-aura-border">
        <button
          onClick={prevDefect}
          className="flex items-center gap-1 font-mono text-[10px] font-semibold text-aura-text-dim hover:text-aura-text p-1 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>PREV</span>
        </button>

        <span className="font-mono text-[10px] font-bold text-aura-cyan">
          DEFECT {selectedDefectIndex + 1} / {defects.length}
        </span>

        <button
          onClick={nextDefect}
          className="flex items-center gap-1 font-mono text-[10px] font-semibold text-aura-text-dim hover:text-aura-text p-1 transition-colors cursor-pointer"
        >
          <span>NEXT</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
