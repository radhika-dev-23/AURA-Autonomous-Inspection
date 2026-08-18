import React from 'react';
import { cn } from '../../lib/utils';

interface TechnicalLabelProps {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}

export const TechnicalLabel: React.FC<TechnicalLabelProps> = ({ label, value, accent, className }) => {
  return (
    <div className={cn('flex items-baseline gap-2 font-mono text-[10px]', className)}>
      <span className="text-aura-text-muted text-[9px] min-w-[100px] uppercase tracking-wider">{label}</span>
      <span className={cn('font-semibold tracking-wide', accent ? 'text-aura-cyan' : 'text-aura-text')}>{value}</span>
    </div>
  );
};
