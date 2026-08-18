import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useInspectionStore } from '../../store/inspectionStore';

interface AnomalyMarkersProps {
  boardWidth?: number;
  boardDepth?: number;
  thickness?: number;
}

export const AnomalyMarkers: React.FC<AnomalyMarkersProps> = ({
  boardWidth = 10,
  boardDepth = 6.4,
  thickness = 0.18,
}) => {
  const defects = useInspectionStore((s) => s.defects);
  const rechecks = useInspectionStore((s) => s.rechecks);
  const decision = useInspectionStore((s) => s.decision);
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (pulseRef.current) {
      const s = 1 + Math.sin(Date.now() * 0.005) * 0.06;
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
        const isFail = decision === 'FAIL' || defect.severity === 'CRITICAL' || defect.severity === 'HIGH';
        const isRecheck = rechecks > 0 && !decision;
        const color = isFail ? '#FF3B30' : isRecheck ? '#FFB300' : '#FFB300';

        // Map pixel coords (0..800, 0..600) to 3D Board Coords (-boardWidth/2..boardWidth/2, -boardDepth/2..boardDepth/2)
        const centerX = ((bbox.x + bbox.w / 2 - imgW / 2) / imgW) * boardWidth;
        const centerZ = ((bbox.y + bbox.h / 2 - imgH / 2) / imgH) * boardDepth;
        const width3D = (bbox.w / imgW) * boardWidth;
        const depth3D = (bbox.h / imgH) * boardDepth;

        return (
          <group key={index} position={[centerX, 0, centerZ]}>
            {/* Translucent Anomaly Highlight Plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[width3D, depth3D]} />
              <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
            </mesh>

            {/* Pulsing Outer Ring Bracket */}
            <mesh ref={index === 0 ? pulseRef : null} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[width3D + 0.2, depth3D + 0.2]} />
              <meshBasicMaterial color={color} wireframe transparent opacity={0.8} />
            </mesh>

            {/* Vertical Light Indicator Beam */}
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.02, 0.08, 2.4, 16]} />
              <meshBasicMaterial color={color} transparent opacity={0.4} />
            </mesh>

            {/* Floating 3D Label overlay */}
            <Html position={[0, 2.6, 0]} center distanceFactor={12} zIndexRange={[100, 0]}>
              <div className="flex flex-col items-center pointer-events-none select-none">
                <div
                  className="px-2 py-0.5 font-mono text-[9px] font-bold border tracking-wider bg-black/90 shadow-md whitespace-nowrap"
                  style={{ color, borderColor: color }}
                >
                  {isRecheck ? 'RECHECK TARGET' : `${defect.severity} ${defect.defect_type.replace(/_/g, ' ')}`}
                </div>
                <div className="w-px h-3" style={{ backgroundColor: color }} />
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
};
