import React from 'react';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: 'pass' | 'fail' | 'recheck' | 'online' | 'sim' | string;
  text: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text, className }) => {
  const getColors = () => {
    switch (status.toLowerCase()) {
      case 'pass':
        return 'border-aura-green text-aura-green bg-aura-green/5';
      case 'fail':
        return 'border-aura-red text-aura-red bg-aura-red/5';
      case 'recheck':
      case 'rechecking':
        return 'border-aura-amber text-aura-amber bg-aura-amber/5 animate-pulse-subtle';
      case 'online':
        return 'border-aura-green text-aura-green bg-transparent';
      case 'sim':
        return 'border-aura-cyan text-aura-cyan bg-transparent';
      default:
        return 'border-aura-border-hi text-aura-text-dim bg-transparent';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-mono text-[9px] font-bold px-1.5 py-0.5 border tracking-wider uppercase',
        getColors(),
        className
      )}
    >
      {text}
    </span>
  );
};
