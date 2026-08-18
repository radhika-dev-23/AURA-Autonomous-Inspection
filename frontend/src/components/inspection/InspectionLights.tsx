import React from 'react';
import { useInspectionStore } from '../../store/inspectionStore';

export const InspectionLights: React.FC = () => {
  const rechecks = useInspectionStore((s) => s.rechecks);
  const isRecheck = rechecks > 0;

  return (
    <>
      {/* Soft Ambient Light */}
      <ambientLight intensity={0.7} color="#18202c" />

      {/* Main Overhead Inspection Directional Light */}
      <directionalLight
        position={[6, 12, 6]}
        intensity={isRecheck ? 1.4 : 1.2}
        color={isRecheck ? '#fff8eb' : '#f0f9ff'}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Rim / Backlight for Metallic Polish */}
      <directionalLight position={[-8, 6, -8]} intensity={0.5} color="#00D4FF" />
    </>
  );
};
