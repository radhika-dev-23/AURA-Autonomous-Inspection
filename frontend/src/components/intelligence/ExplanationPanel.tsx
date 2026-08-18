import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';

export const ExplanationPanel: React.FC = () => {
  const reasoning = useInspectionStore((s) => s.reasoning);

  return (
    <div className="mt-auto pt-3 border-t border-aura-border flex flex-col gap-2">
      <span className="font-mono text-[9px] text-aura-text-muted tracking-widest uppercase">
        AI INSPECTION EXPLANATION
      </span>

      <ul className="flex flex-col gap-1.5 font-sans text-[11px] text-aura-text leading-relaxed">
        {reasoning.map((item, idx) => (
          <li key={idx} className="relative pl-3 text-aura-text before:content-['›'] before:absolute before:left-0 before:text-aura-text-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};
