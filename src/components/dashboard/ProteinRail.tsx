'use client'

import { useMemo } from 'react'
import type { Meal } from '@/types'
import {
  DEFAULT_PROTEIN_MULTIPLIER,
  getProteinTarget,
  getTodayProtein,
} from '@/lib/protein-target'
import { cn } from '@/lib/utils'

interface Props {
  meals: Meal[]
  weightLbs: number
  multiplier?: number
}

/**
 * Compact daily-protein rail. Rendered inside today's day card. Separate from
 * the 7-day longevity score because protein has different physiology (daily
 * reset, body-weight-based target — see protein-target.ts).
 *
 * The outer wrapper is layout-neutral — the parent owns spacing/borders.
 */
export function ProteinRail({ meals, weightLbs, multiplier = DEFAULT_PROTEIN_MULTIPLIER }: Props) {
  const today = useMemo(() => new Date(), [])
  const current = getTodayProtein(meals, today)
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

  const hour = today.getHours()
  // Show the tip once the day is winding down (>= 5pm) and you're under 70%
  // of target — past that point it's too late to comfortably catch up without
  // eating poorly.
  const showTip = hour >= 17 && pct < 0.7 && current < target

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Today&apos;s protein
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

      {showTip ? (
        <p className="text-sm text-muted-foreground mt-2 leading-snug">
          <span className="font-medium text-foreground">Behind for today —</span> try
          1 cup Greek yogurt (~23g), ½ cup cottage cheese (~13g), or a whey scoop (~25g).
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1.5">
          {multiplier.toFixed(2).replace(/\.?0+$/, '')} g/lb · resets at midnight
        </p>
      )}
    </div>
  )
}
