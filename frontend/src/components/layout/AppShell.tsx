import React from 'react';
import { TopBar } from './TopBar';
import { MissionSidebar } from './MissionSidebar';
import { InspectionViewport } from '../inspection/InspectionViewport';
import { DecisionPanel } from '../intelligence/DecisionPanel';
import { TimelineBar } from './TimelineBar';
import { useInspectionSocket } from '../../hooks/useInspectionSocket';

export const AppShell: React.FC = () => {
  // Activate WebSocket listener loop
  useInspectionSocket();

  return (
    <div className="flex flex-col h-screen w-screen bg-aura-bg text-aura-text overflow-hidden select-none">
      {/* Top Header Bar */}
      <TopBar />

      {/* Main Grid Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel: Mission Control */}
        <MissionSidebar />

        {/* Center Panel: 3D Digital Twin Inspection Viewport */}
        <InspectionViewport />

        {/* Right Panel: Decision Intelligence */}
        <DecisionPanel />
      </main>

      {/* Bottom Panel: Event Timeline */}
      <TimelineBar />
    </div>
  );
};
