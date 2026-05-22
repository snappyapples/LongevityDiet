'use client'

import { useState } from 'react'
import { Plus, Minus, ChevronDown, ChevronUp, Check } from 'lucide-react'
import type { LongevityReport } from '@/types'
import { getRankedComponentTips, type ComponentTip } from '@/lib/longevity-score'
import { cn } from '@/lib/utils'

const DIALED_IN_THRESHOLD = 0.5
const DEFAULT_VISIBLE = 3

interface Props {
  report: LongevityReport
  /**
   * Whether the whole "What to eat next" section is expanded by default.
   * When false (the default), the user sees a collapsed header with a
   * summary and has to tap to reveal the full list.
   */
  defaultOpen?: boolean
}

export function LongevityComponentList({ report, defaultOpen = false }: Props) {
  const [sectionOpen, setSectionOpen] = useState(defaultOpen)
  const [expanded, setExpanded] = useState(false)
  const tips = getRankedComponentTips(report)

  if (tips.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          Log a meal to see what to eat next.
        </p>
      </div>
    )
  }

  const actionable = tips.filter((t) => t.gapPoints >= DIALED_IN_THRESHOLD)
  const dialedIn = tips.filter((t) => t.gapPoints < DIALED_IN_THRESHOLD)

  if (actionable.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center gap-2 text-quality-green">
          <Check className="w-5 h-5" />
          <span className="text-base font-semibold">
            You&apos;re dialed in — maintain this pattern.
          </span>
        </div>
      </div>
    )
  }

  // Collapsed: just a header with summary + chevron, click to open.
  if (!sectionOpen) {
    return (
      <div className="mt-4 pt-4 border-t">
        <button
          onClick={() => setSectionOpen(true)}
          className="w-full flex items-center justify-between gap-3 text-left py-1 hover:opacity-80 transition-opacity"
        >
          <div className="min-w-0">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              What to eat next
            </h3>
            <p className="text-sm text-foreground mt-0.5">
              <span className="font-medium">{actionable.length} actionable gap{actionable.length === 1 ? '' : 's'}</span>
              {dialedIn.length > 0 && (
                <span className="text-muted-foreground"> · {dialedIn.length} dialed in</span>
              )}
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </div>
    )
  }

  const visibleCount = expanded ? actionable.length : Math.min(DEFAULT_VISIBLE, actionable.length)
  const visible = actionable.slice(0, visibleCount)
  const hiddenCount = actionable.length - visibleCount
  const hasMore = hiddenCount > 0 || (!expanded && actionable.length > DEFAULT_VISIBLE)

  return (
    <div className="mt-4 pt-4 border-t space-y-3">
      <button
        onClick={() => setSectionOpen(false)}
        className="w-full flex items-baseline justify-between gap-2 text-left hover:opacity-80 transition-opacity"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What to eat next
        </h3>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          Ranked by biggest gap
          <ChevronUp className="w-4 h-4" />
        </span>
      </button>

      <div className="space-y-3">
        {visible.map((tip, i) => (
          <ComponentRow key={tip.component} tip={tip} rank={i + 1} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {hiddenCount} more
            </>
          )}
        </button>
      )}

      {dialedIn.length > 0 && (
        <div className="flex items-start gap-2 pt-2 border-t text-sm text-muted-foreground">
          <Check className="w-4 h-4 text-quality-green shrink-0 mt-0.5" />
          <span>
            <span className="font-medium text-foreground">{dialedIn.length} dialed in:</span>{' '}
            {dialedIn.map((t) => t.label).join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}

function ComponentRow({ tip, rank }: { tip: ComponentTip; rank: number }) {
  const pct = tip.max > 0 ? tip.current / tip.max : 0
  const pctWidth = Math.max(0, Math.min(100, pct * 100))
  const isAdd = tip.kind === 'add'
  const Icon = isAdd ? Plus : Minus
  const iconColor = isAdd ? 'text-quality-green' : 'text-quality-red'
  const iconBg = isAdd ? 'bg-quality-green/10' : 'bg-quality-red/10'
  const barColor = pct >= 0.8 ? 'bg-quality-green' : pct >= 0.5 ? 'bg-quality-yellow' : 'bg-quality-red'

  return (
    <div
      className={cn(
        'p-3 rounded-lg border',
        rank === 1 ? 'border-primary/30 bg-primary/5' : 'border-border',
      )}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className={cn('shrink-0 w-7 h-7 rounded-full flex items-center justify-center', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
        <span className="flex-1 text-base font-semibold">{tip.label}</span>
        <span className="tabular-nums text-sm font-medium">
          {tip.current.toFixed(1)}
          <span className="text-muted-foreground font-normal">/{tip.max}</span>
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-2">
        <div
          className={cn('h-full transition-all duration-500', barColor)}
          style={{ width: `${pctWidth}%` }}
        />
      </div>

      <p className="text-sm text-muted-foreground leading-snug">
        {rank === 1 && (
          <span className="inline-block mr-1.5 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-xs font-bold uppercase tracking-wide">
            Top gap
          </span>
        )}
        {tip.suggestion}
      </p>
    </div>
  )
}
