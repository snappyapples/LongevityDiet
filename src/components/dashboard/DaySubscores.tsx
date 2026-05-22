'use client'

import { Leaf, Droplet, Fish, ShieldCheck } from 'lucide-react'
import type { LongevityDailyScore } from '@/types'
import { cn } from '@/lib/utils'

interface SubscoreMeta {
  key: 'plants' | 'fatQuality' | 'proteinQuality' | 'harmReduction'
  label: string
  shortLabel: string
  icon: typeof Leaf
}

const SUBSCORES: SubscoreMeta[] = [
  { key: 'plants', label: 'Plants', shortLabel: 'Plants', icon: Leaf },
  { key: 'fatQuality', label: 'Healthy Fat', shortLabel: 'Fat', icon: Droplet },
  { key: 'proteinQuality', label: 'Fish / Omega-3', shortLabel: 'Fish', icon: Fish },
  { key: 'harmReduction', label: 'Harm Reduction', shortLabel: 'Harm', icon: ShieldCheck },
]

interface Props {
  score: LongevityDailyScore
}

/**
 * 2×2 grid of the four subscores that make up the daily longevity score.
 * Each card shows label, points/max, and a progress bar.
 *
 * - Plants (50 max): veg + fruit + legumes + whole grains + nuts/seeds
 * - Fat Quality (10 max): healthy fat (EVOO, avocado, etc.)
 * - Fish / Omega-3 (10 max): fatty fish weekly target
 * - Harm Reduction (30 max): sugary drinks + red/processed meat + UPF (reverse-scored)
 */
export function DaySubscores({ score }: Props) {
  if (!score.hasData) {
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {SUBSCORES.map((meta) => {
        const sub = score.subscores[meta.key]
        const pct = sub.max > 0 ? sub.points / sub.max : 0
        const pctWidth = Math.max(0, Math.min(100, pct * 100))
        const barColor =
          pct >= 0.8 ? 'bg-quality-green' : pct >= 0.5 ? 'bg-quality-yellow' : 'bg-quality-red'
        const Icon = meta.icon
        return (
          <div key={meta.key} className="rounded-lg border p-2.5 bg-background">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate">
                  {meta.label}
                </span>
              </div>
              <span className="tabular-nums text-sm font-semibold shrink-0">
                {sub.points.toFixed(0)}
                <span className="text-muted-foreground font-normal text-xs">/{sub.max}</span>
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full transition-all duration-500', barColor)}
                style={{ width: `${pctWidth}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
