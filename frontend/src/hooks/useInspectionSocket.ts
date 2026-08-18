import { useEffect, useRef } from 'react';
import { InspectionWebSocket } from '../lib/websocket';
import { useInspectionStore } from '../store/inspectionStore';
import { WSStateUpdateSchema, WSInspectionCompleteSchema, WSErrorSchema } from '../lib/validation';

export function useInspectionSocket() {
  const handleStateUpdate = useInspectionStore((s) => s.handleStateUpdate);
  const handleInspectionComplete = useInspectionStore((s) => s.handleInspectionComplete);
  const handleError = useInspectionStore((s) => s.handleError);
  const setConnected = useInspectionStore((s) => s.setConnected);

  const socketRef = useRef<InspectionWebSocket | null>(null);

  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
    
    const ws = new InspectionWebSocket(
      wsUrl,
      (msg) => {
        if (msg.type === 'state_update') {
          const parsed = WSStateUpdateSchema.safeParse(msg);
          if (parsed.success) {
            handleStateUpdate(parsed.data as any);
          } else {
            handleStateUpdate(msg);
          }
        } else if (msg.type === 'inspection_complete') {
          const parsed = WSInspectionCompleteSchema.safeParse(msg);
          if (parsed.success) {
            handleInspectionComplete(parsed.data as any);
          } else {
            handleInspectionComplete(msg);
          }
        } else if (msg.type === 'error') {
          const parsed = WSErrorSchema.safeParse(msg);
          handleError(parsed.success ? parsed.data.message : msg.message || 'Unknown server error');
        }
      },
      (connected) => setConnected(connected)
    );

    ws.connect();
    socketRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [handleStateUpdate, handleInspectionComplete, handleError, setConnected]);
}
