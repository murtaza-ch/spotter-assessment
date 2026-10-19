import type { RiskLevel } from './types'

export const riskLevels: RiskLevel[] = [0, 1, 2, 3, 4, -1]
export const riskStyle: Record<RiskLevel, { label: string; color: string; background: string }> = {
  '-1': { label: 'Unknown', color: '#65747a', background: '#eef0f1' },
  0: { label: 'Low', color: '#25724c', background: '#e9f2eb' },
  1: { label: 'Moderate', color: '#8a640c', background: '#fbf2d4' },
  2: { label: 'High', color: '#b45419', background: '#fcebdc' },
  3: { label: 'Severe', color: '#b33636', background: '#fbe8e7' },
  4: { label: 'No Travel', color: '#692c47', background: '#f2e6ed' },
}

export function durationLabel(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  return hours ? `${hours}h ${totalMinutes % 60}m` : `${totalMinutes}m`
}

export function timeLabel(value: string, includeDate = false): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(includeDate ? ({ month: 'short', day: 'numeric' } as const) : {}),
  }).format(new Date(value))
}

export function localInputDate(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return adjusted.toISOString().slice(0, 16)
}
