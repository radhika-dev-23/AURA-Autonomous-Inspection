import React, { useEffect, useRef } from 'react';
import { BBox } from '../../types/inspection';

interface DefectCropCanvasProps {
  imagePath: string | null;
  bbox: BBox;
  severity: string;
  defectType: string;
}

export const DefectCropCanvas: React.FC<DefectCropCanvasProps> = ({
  imagePath,
  bbox,
  severity,
  defectType,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const defaultPath = '/data/pcb/test/current.jpg';
    const src = imagePath ? (imagePath.startsWith('/') ? imagePath : '/' + imagePath) : defaultPath;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    img.onload = () => {
      const cw = canvas.width;
      const ch = canvas.height;

      // 30% padding around defect BBox
      const padX = bbox.w * 0.35;
      const padY = bbox.h * 0.35;

      const cropX = Math.max(0, bbox.x - padX);
      const cropY = Math.max(0, bbox.y - padY);
      const cropW = Math.min(img.width - cropX, bbox.w + padX * 2);
      const cropH = Math.min(img.height - cropY, bbox.h + padY * 2);

      // Clear canvas
      ctx.fillStyle = '#08090a';
      ctx.fillRect(0, 0, cw, ch);

      // Draw cropped image region onto canvas
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cw, ch);

      // Map defect BBox inside the crop canvas coordinates
      const scaleX = cw / cropW;
      const scaleY = ch / cropH;

      const boxX = (bbox.x - cropX) * scaleX;
      const boxY = (bbox.y - cropY) * scaleY;
      const boxW = bbox.w * scaleX;
      const boxH = bbox.h * scaleY;

      // Color coding
      const isFail = severity === 'CRITICAL' || severity === 'HIGH';
      const color = isFail ? '#FF3B30' : '#FFB300';

      // Draw translucent highlight box
      ctx.fillStyle = isFail ? 'rgba(255, 59, 48, 0.2)' : 'rgba(255, 179, 0, 0.2)';
      ctx.fillRect(boxX, boxY, boxW, boxH);

      // Draw industrial L-corner brackets inside 2D canvas
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      const cs = Math.min(boxW, boxH, 16);

      // Top-Left
      ctx.beginPath(); ctx.moveTo(boxX, boxY + cs); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + cs, boxY); ctx.stroke();
      // Top-Right
      ctx.beginPath(); ctx.moveTo(boxX + boxW - cs, boxY); ctx.lineTo(boxX + boxW, boxY); ctx.lineTo(boxX + boxW, boxY + cs); ctx.stroke();
      // Bottom-Left
      ctx.beginPath(); ctx.moveTo(boxX, boxY + boxH - cs); ctx.lineTo(boxX, boxY + boxH); ctx.lineTo(boxX + cs, boxY + boxH); ctx.stroke();
      // Bottom-Right
      ctx.beginPath(); ctx.moveTo(boxX + boxW - cs, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH); ctx.lineTo(boxX + boxW, boxY + boxH - cs); ctx.stroke();

      // Technical BBox Tag Overlay
      ctx.fillStyle = 'rgba(8, 9, 10, 0.85)';
      ctx.fillRect(boxX, Math.max(0, boxY - 18), 160, 16);
      ctx.fillStyle = color;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.fillText(`X:${bbox.x} Y:${bbox.y} W:${bbox.w} H:${bbox.h}`, boxX + 4, Math.max(0, boxY - 6));
    };

    img.onerror = () => {
      ctx.fillStyle = '#0e1014';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#555566';
      ctx.font = '10px "JetBrains Mono"';
      ctx.fillText('CROP UNAVAILABLE', 80, 100);
    };
  }, [imagePath, bbox, severity, defectType]);

  return (
    <div className="relative w-full h-44 bg-black border border-aura-border overflow-hidden">
      <canvas ref={canvasRef} width={280} height={176} className="w-full h-full block" />
      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 font-mono text-[8px] font-bold text-aura-cyan bg-black/80 border border-aura-cyan/40">
        MAGNIFIED 2D CROP
      </div>
    </div>
  );
};
