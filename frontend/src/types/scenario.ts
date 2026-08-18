export interface Scenario {
  id: string;
  name: string;
  description: string;
}

export type ScenarioPathBadge = 'pass' | 'fail' | 'recheck';

export interface ScenarioMeta {
  badge: ScenarioPathBadge;
  badgeText: string;
  hint: string;
}
