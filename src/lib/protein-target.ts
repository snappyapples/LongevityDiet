import { format } from 'date-fns'
import type { Meal } from '@/types'

/**
 * Per Peter Attia (Outlive), recommended daily protein intake is body-weight-based,
 * not calorie-based. Unlike AHEI components, the target does NOT roll over week
 * to week — muscle protein synthesis resets daily, so a missed day cannot be
 * "made up" later. This rail therefore lives outside the 7-day rolling longevity
 * score.
 *
 * Multipliers (g protein per lb of bodyweight):
 *   0.70 — "gentle" — minimum for healthy aging in sedentary/moderate activity
 *   0.85 — "standard" — Attia's daily recommendation for most adults
 *   1.00 — "full" — Attia's upper-range target for active adults / muscle building
 */
export const DEFAULT_PROTEIN_MULTIPLIER = 0.7

export type ProteinPresetId = 'gentle' | 'standard' | 'full'

export const PROTEIN_PRESETS: Record<ProteinPresetId, { multiplier: number; label: string }> = {
  gentle: { multiplier: 0.7, label: 'Gentle' },
  standard: { multiplier: 0.85, label: 'Standard' },
  full: { multiplier: 1.0, label: 'Full' },
}

export function getProteinTarget(
  weightLbs: number,
  multiplier: number = DEFAULT_PROTEIN_MULTIPLIER,
): number {
  if (!weightLbs || weightLbs <= 0) return 0
  return Math.round(weightLbs * multiplier)
}

/**
 * Sum of `totalProtein` across all meals whose `date` matches today (yyyy-MM-dd).
 * Uses the same date-string comparison as the rest of the app — no timezone math.
 */
export function getTodayProtein(meals: Meal[], today: Date = new Date()): number {
  const todayStr = format(today, 'yyyy-MM-dd')
  return meals
    .filter((m) => m.date === todayStr)
    .reduce((sum, m) => sum + (m.totalProtein ?? 0), 0)
}
