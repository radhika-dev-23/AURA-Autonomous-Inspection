import React, { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useInspectionStore } from '../../store/inspectionStore';

interface InspectionCameraProps {
  boardWidth?: number;
  boardDepth?: number;
}

export const InspectionCamera: React.FC<InspectionCameraProps> = ({
  boardWidth = 10,
  boardDepth = 6.4,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);

  const state = useInspectionStore((s) => s.state);
  const rechecks = useInspectionStore((s) => s.rechecks);
  const defects = useInspectionStore((s) => s.defects);

  // Compute anomaly target center if defect exists
  const targetPos = React.useMemo(() => {
    if (defects && defects.length > 0) {
      const d = defects[0];
      const imgW = 800;
      const imgH = 600;
      const bx = d.bbox.x + d.bbox.w / 2;
      const by = d.bbox.y + d.bbox.h / 2;
      const tx = ((bx - imgW / 2) / imgW) * boardWidth;
      const tz = ((by - imgH / 2) / imgH) * boardDepth;
      return new THREE.Vector3(tx, 0, tz);
    }
    return new THREE.Vector3(0, 0, 0);
  }, [defects, boardWidth, boardDepth]);

  // Desired camera rig target position and rotation
  const isRecheckView = rechecks > 0 && (state === 'POSITIONING' || state === 'ACQUIRING' || state === 'ANALYZING' || state === 'RECHECKING' || state === 'FUSING' || state === 'EVALUATING');

  const desiredPos = useMemo(() => {
    if (isRecheckView) {
      return new THREE.Vector3(targetPos.x, 2.4, targetPos.z + 1.8);
    }
    return new THREE.Vector3(0, 4.5, 0);
  }, [isRecheckView, targetPos]);

  const desiredRot = useMemo(() => {
    if (isRecheckView) {
      // Angle down at 35 degrees towards target
      return new THREE.Euler(THREE.MathUtils.degToRad(-35), THREE.MathUtils.degToRad(15), 0);
    }
    // Direct top down view pointing down
    return new THREE.Euler(THREE.MathUtils.degToRad(-90), 0, 0);
  }, [isRecheckView]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Smooth lerp for position and rotation
    groupRef.current.position.lerp(desiredPos, delta * 3.5);

    const targetQuaternion = new THREE.Quaternion().setFromEuler(desiredRot);
    groupRef.current.quaternion.slerp(targetQuaternion, delta * 3.5);

    // Pulse lens spotlight during scanning / acquiring
    if (spotLightRef.current && (state === 'ACQUIRING' || state === 'ANALYZING')) {
      spotLightRef.current.intensity = 2.5 + Math.sin(Date.now() * 0.01) * 0.8;
    } else if (spotLightRef.current) {
      spotLightRef.current.intensity = isRecheckView ? 2.8 : 2.0;
    }
  });

  return (
    <group ref={groupRef} position={[0, 4.5, 0]} rotation={[THREE.MathUtils.degToRad(-90), 0, 0]}>
      {/* Robot Gantry Support Rail */}
      <mesh position={[0, 0, 0.4]}>
        <boxGeometry args={[1.2, 0.12, 0.12]} />
        <meshStandardMaterial color="#1a1c24" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Camera Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.7, 0.5, 0.7]} />
        <meshStandardMaterial color="#121418" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Cyan Accent Strip on Camera */}
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.72, 0.02, 0.72]} />
        <meshBasicMaterial color="#00D4FF" />
      </mesh>

      {/* Lens Barrel */}
      <mesh position={[0, 0, -0.35]} rotation={[THREE.MathUtils.degToRad(90), 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.4, 32]} />
        <meshStandardMaterial color="#22252e" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Lens Glass glowing Ring */}
      <mesh position={[0, 0, -0.56]} rotation={[THREE.MathUtils.degToRad(90), 0, 0]}>
        <ringGeometry args={[0.12, 0.2, 32]} />
        <meshBasicMaterial color={isRecheckView ? '#FFB300' : '#00D4FF'} />
      </mesh>

      {/* Camera Spotlight targeting PCB surface */}
      <spotLight
        ref={spotLightRef}
        position={[0, 0, -0.5]}
        target-position={[0, 0, -4]}
        angle={Math.PI / 6}
        penumbra={0.4}
        intensity={2.0}
        color={isRecheckView ? '#fff5e0' : '#e6f7ff'}
        castShadow
      />
    </group>
  );
};
