import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';

interface PCBBoardProps {
  texturePath: string | null;
  boardWidth?: number;
  boardDepth?: number;
  thickness?: number;
}

// High-quality procedural dark green PCB texture fallback using HTML Canvas
function createFallbackPCBTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Dark green FR4 solder mask background
  ctx.fillStyle = '#0a2414';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle grid lines / circuit traces
  ctx.strokeStyle = '#123d22';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 512; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
  }

  // Copper / gold pads around edges and center
  ctx.fillStyle = '#a68524';
  ctx.strokeStyle = '#856a1b';
  ctx.lineWidth = 2;
  for (let x = 64; x < 512; x += 128) {
    for (let y = 64; y < 512; y += 128) {
      ctx.fillRect(x - 10, y - 10, 20, 20);
      ctx.strokeRect(x - 14, y - 14, 28, 28);
    }
  }

  // Silk screen text label
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = 'bold 22px monospace';
  ctx.fillText('AURA — DIGITAL INSPECTION CELL', 60, 260);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const PCBBoard: React.FC<PCBBoardProps> = ({
  texturePath,
  boardWidth = 10,
  boardDepth = 6.4,
  thickness = 0.18,
}) => {
  const fallbackTexture = useMemo(() => createFallbackPCBTexture(), []);
  const [texture, setTexture] = useState<THREE.Texture>(fallbackTexture);

  useEffect(() => {
    if (!texturePath) {
      setTexture(fallbackTexture);
      return;
    }

    const loader = new THREE.TextureLoader();
    const url = texturePath.startsWith('/') ? texturePath : '/' + texturePath;

    let isMounted = true;

    loader.load(
      url,
      (loadedTex) => {
        if (!isMounted) return;
        loadedTex.needsUpdate = true;
        setTexture(loadedTex);
      },
      undefined,
      (err) => {
        if (!isMounted) return;
        console.warn('PCB texture load fallback used for:', url, err);
        setTexture(fallbackTexture);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [texturePath, fallbackTexture]);

  // Setup materials for 6 faces of the PCB slab box
  const materials = useMemo(() => {
    // Green FR4 solder mask base material
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: '#0e2b19',
      roughness: 0.4,
      metalness: 0.2,
    });

    const bottomMaterial = new THREE.MeshStandardMaterial({
      color: '#091c10',
      roughness: 0.6,
      metalness: 0.1,
    });

    // Top material mapped with the active PCB texture
    const topMaterial = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.35,
      metalness: 0.15,
    });

    // BoxGeometry material index order: +X (0), -X (1), +Y (2, TOP), -Y (3, BOTTOM), +Z (4), -Z (5)
    return [
      sideMaterial,   // Right
      sideMaterial,   // Left
      topMaterial,    // Top (PCB Image)
      bottomMaterial, // Bottom
      sideMaterial,   // Front
      sideMaterial,   // Back
    ];
  }, [texture]);

  return (
    <group position={[0, 0, 0]}>
      {/* Metallic sub-base plate/tray under the PCB */}
      <mesh position={[0, -thickness / 2 - 0.04, 0]}>
        <boxGeometry args={[boardWidth + 0.3, 0.08, boardDepth + 0.3]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Main PCB Slab */}
      <mesh material={materials} position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[boardWidth, thickness, boardDepth]} />
      </mesh>

      {/* Subtle edge bevel / mounting standoffs at four corners */}
      {[-boardWidth / 2 + 0.4, boardWidth / 2 - 0.4].map((x, i) =>
        [-boardDepth / 2 + 0.4, boardDepth / 2 - 0.4].map((z, j) => (
          <mesh key={`${i}-${j}`} position={[x, -thickness / 2 - 0.08, z]}>
            <cylinderGeometry args={[0.12, 0.15, 0.16, 16]} />
            <meshStandardMaterial color="#333842" metalness={0.9} roughness={0.2} />
          </mesh>
        ))
      )}
    </group>
  );
};
