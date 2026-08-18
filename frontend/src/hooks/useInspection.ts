import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchScenarios, startInspection, fetchSystemStatus } from '../lib/api';
import { useInspectionStore } from '../store/inspectionStore';

export function useScenarios() {
  const setScenarios = useInspectionStore((s) => s.setScenarios);

  return useQuery({
    queryKey: ['scenarios'],
    queryFn: async () => {
      const scenarios = await fetchScenarios();
      setScenarios(scenarios);
      return scenarios;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ['systemStatus'],
    queryFn: fetchSystemStatus,
    refetchInterval: 10000,
  });
}

export function useStartInspection() {
  const setInspRunning = useInspectionStore((s) => s.setInspRunning);
  const resetUI = useInspectionStore((s) => s.resetUI);

  return useMutation({
    mutationFn: async (scenarioId: string) => {
      setInspRunning(true);
      resetUI(false);
      return startInspection(scenarioId);
    },
    onError: (err) => {
      console.error('Start inspection error:', err);
      setInspRunning(false);
    },
  });
}
