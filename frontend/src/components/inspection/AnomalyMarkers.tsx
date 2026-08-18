import React, { useState, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useInspectionStore } from '../../store/inspectionStore';

interface AnomalyMarkersProps {
  boardWidth?: number;
  boardDepth?: number;
  thickness?: number;
}

// 3D Corner Bracket helper rendering industrial ┌ ┐ └ ┘ machine vision markers
const CornerBrackets: React.FC<{
  w: number;
  h: number;
  color: string;
  thick?: number;
}> = ({ w, h, color, thick = 0.03 }) => {
  const cs = Math.min(w, h) * 0.25; // Corner bracket leg length

  return (
    <group>
      {/* Top-Left Corner */}
      <mesh position={[-w / 2 + cs / 2, 0, -h / 2]}>
        <boxGeometry args={[cs, thick, thick]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[-w / 2, 0, -h / 2 + cs / 2]}>
        <boxGeometry args={[thick, thick, cs]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Top-Right Corner */}
      <mesh position={[w / 2 - cs / 2, 0, -h / 2]}>
        <boxGeometry args={[cs, thick, thick]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[w / 2, 0, -h / 2 + cs / 2]}>
        <boxGeometry args={[thick, thick, cs]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Bottom-Left Corner */}
      <mesh position={[-w / 2 + cs / 2, 0, h / 2]}>
        <boxGeometry args={[cs, thick, thick]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[-w / 2, 0, h / 2 - cs / 2]}>
        <boxGeometry args={[thick, thick, cs]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Bottom-Right Corner */}
      <mesh position={[w / 2 - cs / 2, 0, h / 2]}>
        <boxGeometry args={[cs, thick, thick]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[w / 2, 0, h / 2 - cs / 2]}>
        <boxGeometry args={[thick, thick, cs]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};

export const AnomalyMarkers: React.FC<AnomalyMarkersProps> = ({
  boardWidth = 10,
  boardDepth = 6.4,
  thickness = 0.18,
}) => {
  const defects = useInspectionStore((s) => s.defects);
  const rechecks = useInspectionStore((s) => s.rechecks);
  const decision = useInspectionStore((s) => s.decision);
  const selectedDefectIndex = useInspectionStore((s) => s.selectedDefectIndex);
  const isFocusMode = useInspectionStore((s) => s.isFocusMode);
  const selectDefect = useInspectionStore((s) => s.selectDefect);
  const setFocusMode = useInspectionStore((s) => s.setFocusMode);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const pulseRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (pulseRef.current) {
      const s = 1 + Math.sin(Date.now() * 0.006) * 0.08;
      pulseRef.current.scale.set(s, 1, s);
    }
  });

  if (!defects || defects.length === 0) return null;

  const imgW = 800;
  const imgH = 600;

  return (
    <group position={[0, thickness / 2 + 0.02, 0]}>
      {defects.map((defect, index) => {
        const bbox = defect.bbox;
        const isSelected = selectedDefectIndex === index;
        const isHovered = hoveredIndex === index;
        const isPrimary = index === 0;

        const isFail = decision === 'FAIL' || defect.severity === 'CRITICAL' || defect.severity === 'HIGH';
        const isRecheck = rechecks > 0 && !decision;
        const color = isFail ? '#FF3B30' : isRecheck ? '#FFB300' : '#FFB300';

        // Map pixel coords (0..800, 0..600) to 3D Board Coords (-boardWidth/2..boardWidth/2, -boardDepth/2..boardDepth/2)
        const centerX = ((bbox.x + bbox.w / 2 - imgW / 2) / imgW) * boardWidth;
        const centerZ = ((bbox.y + bbox.h / 2 - imgH / 2) / imgH) * boardDepth;
        const width3D = Math.max((bbox.w / imgW) * boardWidth, 0.4);
        const depth3D = Math.max((bbox.h / imgH) * boardDepth, 0.4);

        // Calculate opacity based on focus mode
        const opacity = isFocusMode ? (isSelected ? 1.0 : 0.15) : (isSelected || isHovered || isPrimary ? 0.9 : 0.4);

        const showLabel = isSelected || isHovered || (isPrimary && !isFocusMode && index === 0);

        return (
          <group
            key={index}
            position={[centerX, 0, centerZ]}
            onClick={(e) => {
              e.stopPropagation();
              selectDefect(index);
              setFocusMode(true);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredIndex(index);
            }}
            onPointerOut={() => setHoveredIndex(null)}
          >
            {/* Translucent Anomaly Region Plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[width3D, depth3D]} />
              <meshBasicMaterial color={color} transparent opacity={opacity * 0.25} side={THREE.DoubleSide} />
            </mesh>

            {/* Industrial Corner Brackets */}
            <CornerBrackets w={width3D} h={depth3D} color={color} thick={isSelected ? 0.04 : 0.02} />

            {/* Pulsing Selection Outline */}
            {isSelected && (
              <group ref={pulseRef}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[width3D + 0.15, depth3D + 0.15]} />
                  <meshBasicMaterial color={color} wireframe transparent opacity={0.8} />
                </mesh>

                {/* Vertical Light Beam on Selected Defect */}
                <mesh position={[0, 1.0, 0]}>
                  <cylinderGeometry args={[0.02, 0.08, 2.0, 16]} />
                  <meshBasicMaterial color={color} transparent opacity={0.5} />
                </mesh>
              </group>
            )}

            {/* Floating HTML Label — Only on hover / selection / primary */}
            {showLabel && (
              <Html position={[0, isSelected ? 2.2 : 1.2, 0]} center distanceFactor={14} zIndexRange={[100, 0]}>
                <div className="flex flex-col items-center pointer-events-auto select-none cursor-pointer">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      selectDefect(index);
                      setFocusMode(true);
                    }}
                    className={`px-2 py-0.5 font-mono text-[9px] font-bold border tracking-wider bg-black/90 shadow-lg whitespace-nowrap transition-transform duration-150 ${
                      isSelected ? 'scale-110 border-2' : 'hover:scale-105'
                    }`}
                    style={{ color, borderColor: color }}
                  >
                    {isSelected ? 'FOCUS TARGET' : `${defect.severity} ${defect.defect_type.replace(/_/g, ' ')}`}
                  </div>
                  <div className="w-px h-2.5" style={{ backgroundColor: color }} />
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
};
