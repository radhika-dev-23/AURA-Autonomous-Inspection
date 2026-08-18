import React from 'react';

export const SceneGrid: React.FC = () => {
  return (
    <group position={[0, -0.2, 0]}>
      {/* Floor Platform */}
      <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[36, 36]} />
        <meshStandardMaterial color="#060709" roughness={0.9} metalness={0.2} />
      </mesh>

      {/* Dark Cyan Grid Helper */}
      <gridHelper args={[36, 36, '#00D4FF', '#182230']} position={[0, 0, 0]} />
    </group>
  );
};
