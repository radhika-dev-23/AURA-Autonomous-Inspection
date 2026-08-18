import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PCBBoard } from './PCBBoard';
import { InspectionCamera } from './InspectionCamera';
import { InspectionLights } from './InspectionLights';
import { AnomalyMarkers } from './AnomalyMarkers';
import { SceneGrid } from './SceneGrid';
import { useInspectionStore } from '../../store/inspectionStore';

export const PCBScene: React.FC = () => {
  const currentImagePath = useInspectionStore((s) => s.currentImagePath);
  const viewMode = useInspectionStore((s) => s.viewMode);

  // Compute effective texture path based on viewMode ('real', 'diff', 'heatmap')
  const effectiveTexturePath = React.useMemo(() => {
    if (viewMode === 'diff') {
      return `/data/pcb/test/current_diff.jpg?t=${Date.now()}`;
    }
    if (viewMode === 'heatmap') {
      return `/data/pcb/test/current_heatmap.jpg?t=${Date.now()}`;
    }
    return currentImagePath;
  }, [viewMode, currentImagePath]);

  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 7.5, 9.5], fov: 45 }}
        shadows
        gl={{ antialias: true, alpha: false }}
        className="w-full h-full block bg-black"
      >
        <Suspense fallback={null}>
          <InspectionLights />
          <SceneGrid />
          <PCBBoard texturePath={effectiveTexturePath} />
          <InspectionCamera />
          <AnomalyMarkers />
          <OrbitControls
            enableDamping
            dampingFactor={0.05}
            minDistance={3}
            maxDistance={22}
            maxPolarAngle={Math.PI / 2 - 0.05}
            target={[0, 0, 0]}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
