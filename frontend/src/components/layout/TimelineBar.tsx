import React, { useRef, useEffect } from 'react';
import { useInspectionStore } from '../../store/inspectionStore';
import { cn } from '../../lib/utils';

export const TimelineBar: React.FC = () => {
  const timeline = useInspectionStore((s) => s.timeline);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [timeline]);

  if (!timeline || timeline.length === 0) {
    return (
      <footer className="h-[64px] border-t border-aura-border bg-aura-panel flex items-center px-6 shrink-0">
        <span className="font-mono text-[10px] text-aura-text-muted">TIMELINE IDLE — SELECT A SCENARIO AND CLICK START INSPECTION</span>
      </footer>
    );
  }

  return (
    <footer className="h-[70px] border-t border-aura-border bg-aura-panel flex items-center px-4 overflow-hidden shrink-0">
      <div
        ref={containerRef}
        className="flex items-center gap-0 w-full overflow-x-auto font-mono py-1 scroll-smooth"
      >
        {timeline.map((item, index) => {
          const isLast = index === timeline.length - 1;
          const ts = new Date(item.time).toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <div
              key={index}
              className={cn(
                'flex flex-col min-w-[120px] px-3 py-1 relative border-r border-aura-border/40 transition-opacity duration-200',
                isLast ? 'opacity-100' : 'opacity-60'
              )}
            >
              <span className="text-[9px] text-aura-text-muted">{ts}</span>
              <span className={cn('text-[10px] font-bold my-0.5', isLast ? 'text-aura-cyan' : 'text-aura-text')}>
                {item.event}
              </span>
              <span className="text-[9px] text-aura-text-muted truncate max-w-[120px]" title={item.desc}>
                {item.desc}
              </span>
            </div>
          );
        })}
      </div>
    </footer>
  );
};
