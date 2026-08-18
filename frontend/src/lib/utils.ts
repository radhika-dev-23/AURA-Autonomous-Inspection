import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number | null | undefined): string {
  if (score == null) return '—';
  return score.toFixed(3);
}

export function formatPercentage(val: number | null | undefined): string {
  if (val == null) return '—';
  return (val * 100).toFixed(1) + '%';
}
