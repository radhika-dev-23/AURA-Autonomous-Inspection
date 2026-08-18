import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useInspectionStore } from '../../store/inspectionStore';

interface CameraFocusControllerProps {
  controlsRef: React.RefObject<any>;
  boardWidth?: number;
  boardDepth?: number;
}

export const CameraFocusController: React.FC<CameraFocusControllerProps> = ({
  controlsRef,
  boardWidth = 10,
  boardDepth = 6.4,
}) => {
  const { camera } = useThree();

  const defects = useInspectionStore((s) => s.defects);
  const selectedDefectIndex = useInspectionStore((s) => s.selectedDefectIndex);
  const isFocusMode = useInspectionStore((s) => s.isFocusMode);

  // Ref tracking whether a camera transition animation is currently running
  const isAnimatingRef = useRef(false);

  // Image dimensions
  const imgW = 800;
  const imgH = 600;

  // Compute desired target position and camera position for the current mode
  const { targetPos, camPos } = useMemo(() => {
    if (isFocusMode && selectedDefectIndex !== null && defects && defects[selectedDefectIndex]) {
      const d = defects[selectedDefectIndex];
      const bbox = d.bbox;

      // Physical center on PCB board
      const bx = ((bbox.x + bbox.w / 2 - imgW / 2) / imgW) * boardWidth;
      const bz = ((bbox.y + bbox.h / 2 - imgH / 2) / imgH) * boardDepth;

      const target = new THREE.Vector3(bx, 0, bz);

      const width3D = (bbox.w / imgW) * boardWidth;
      const depth3D = (bbox.h / imgH) * boardDepth;
      const maxDim = Math.max(width3D, depth3D, 0.4);

      // Scale camera height based on defect size
      const camY = Math.min(Math.max(maxDim * 3.2, 2.2), 5.5);
      const camOffset = camY * 0.85;

      const pos = new THREE.Vector3(bx, camY, bz + camOffset);
      return { targetPos: target, camPos: pos };
    }

    // Default overview position & target
    return {
      targetPos: new THREE.Vector3(0, 0, 0),
      camPos: new THREE.Vector3(0, 7.5, 9.5),
    };
  }, [isFocusMode, selectedDefectIndex, defects, boardWidth, boardDepth]);

  // Trigger camera transition animation whenever mode or target changes
  useEffect(() => {
    isAnimatingRef.current = true;
  }, [targetPos, camPos]);

  useFrame((_, delta) => {
    // ONLY lerp during active camera transition animation
    if (!isAnimatingRef.current) return;

    const controls = controlsRef.current;
    if (!controls) return;

    // Smoothly lerp OrbitControls target and camera position
    controls.target.lerp(targetPos, delta * 5.0);
    camera.position.lerp(camPos, delta * 5.0);
    controls.update();

    // Check if camera and target have arrived at target locations
    const distCam = camera.position.distanceTo(camPos);
    const distTarget = controls.target.distanceTo(targetPos);

    if (distCam < 0.05 && distTarget < 0.05) {
      // Arrived! Lock position once and release control to OrbitControls for user interaction
      camera.position.copy(camPos);
      controls.target.copy(targetPos);
      controls.update();
      isAnimatingRef.current = false;
    }
  });

  return null;
};
