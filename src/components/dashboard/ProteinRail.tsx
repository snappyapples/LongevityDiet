'use client'

import { DEFAULT_PROTEIN_MULTIPLIER, getProteinTarget } from '@/lib/protein-target'
import { cn } from '@/lib/utils'

interface Props {
  /** Grams of protein consumed for the day this rail represents. */
  current: number
  /** User's weight in lbs — drives the daily target. */
  weightLbs: number
  /** Multiplier in g/lb. Defaults to DEFAULT_PROTEIN_MULTIPLIER (0.7). */
  multiplier?: number
  /**
   * When true (the day represented IS today), enables the late-day catch-up
   * tip when behind target after 5pm. For historical days the day is over,
   * so we just show the score without coaching.
   */
  isToday?: boolean
}

/**
 * Compact daily-protein rail. Rendered inside every day card's expanded view.
 * Separate from the 7-day longevity score because protein has different
 * physiology (daily reset, body-weight-based target — see protein-target.ts).
 *
 * The outer wrapper is layout-neutral — the parent owns spacing/borders.
 */
export function ProteinRail({
  current,
  weightLbs,
  multiplier = DEFAULT_PROTEIN_MULTIPLIER,
  isToday = false,
}: Props) {
  const target = getProteinTarget(weightLbs, multiplier)

  if (target <= 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">
          Set your weight in Settings to enable the daily protein target.
        </p>
      </div>
    )
  }

  const pct = current / target
  const pctClamped = Math.max(0, Math.min(1, pct))

  const barColor =
    pct >= 1 ? 'bg-quality-green' : pct >= 0.67 ? 'bg-quality-yellow' : 'bg-quality-red'
  const textColor =
    pct >= 1 ? 'text-quality-green' : pct >= 0.67 ? 'text-quality-yellow' : 'text-quality-red'

  // Show the catch-up tip only when this rail represents today AND the day
  // is winding down (>= 5pm) AND we're under 70% of target.
  const showCatchupTip = isToday && new Date().getHours() >= 17 && pct < 0.7 && current < target

  const headerLabel = isToday ? "Today's protein" : 'Protein'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {headerLabel}
        </span>
        <span className={cn('tabular-nums font-semibold text-base', textColor)}>
          {Math.round(current)}
          <span className="text-muted-foreground font-normal text-sm">/{target}g</span>
        </span>
      </div>

      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full transition-all duration-500', barColor)}
          style={{ width: `${pctClamped * 100}%` }}
        />
      </div>

      {showCatchupTip ? (
        <p className="text-sm text-muted-foreground mt-2 leading-snug">
          <span className="font-medium text-foreground">Behind for today —</span> try
          1 cup Greek yogurt (~23g), ½ cup cottage cheese (~13g), or a whey scoop (~25g).
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1.5">
          Target: {multiplier.toFixed(2).replace(/\.?0+$/, '')} g/lb
        </p>
      )}
    </div>
  )
}
