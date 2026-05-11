'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Loader2, Sparkles, Utensils, Eye, Check, X, ChevronDown, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { FoodItem, LongevityReport, Meal, MealType } from '@/types'
import { buildLongevityReport } from '@/lib/longevity-score'
import { parseWithCache } from '@/lib/parse-cache'
import { CategoryChips } from './CategoryChips'

const COMPONENT_LABELS: Record<keyof LongevityReport['componentsRolling'], string> = {
  vegetables: 'Vegetables',
  fruit: 'Fruit',
  legumes: 'Legumes',
  wholeGrains: 'Whole grains',
  nutsSeeds: 'Nuts/Seeds',
  healthyFat: 'Healthy fat',
  fish: 'Fish',
  sugaryDrinks: 'Sugary drinks',
  redProcessedMeat: 'Red/processed meat',
  ultraProcessed: 'Ultra-processed',
}

function componentDeltas(base: LongevityReport, next: LongevityReport): Array<{ key: string; label: string; delta: number }> {
  const out: Array<{ key: string; label: string; delta: number }> = []
  const keys = Object.keys(COMPONENT_LABELS) as Array<keyof LongevityReport['componentsRolling']>
  for (const k of keys) {
    const d = next.componentsRolling[k].points - base.componentsRolling[k].points
    if (Math.abs(d) >= 0.1) {
      out.push({ key: k, label: COMPONENT_LABELS[k], delta: Math.round(d * 10) / 10 })
    }
  }
  out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return out
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  indulgence: 'Indulgence',
}

const FREQUENT_LIMIT = 12

function defaultMealType(now: Date = new Date()): MealType {
  const h = now.getHours() + now.getMinutes() / 60
  if (h >= 4 && h < 10.5) return 'breakfast'
  if (h >= 10.5 && h < 15) return 'lunch'
  if (h >= 15 && h < 20.5) return 'dinner'
  return 'snack'
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cli_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Top N most-frequently-logged items by name across meals of the given type
 * over the fetched window (~30 days). Ties broken by recency. Skips legacy
 * un-classified items so we don't surface chip-less mystery rows.
 *
 * Filtering by meal type means breakfast pills surface oatmeal/eggs/yogurt,
 * dinner pills surface chicken/salmon/broccoli, etc. — the suggestions match
 * what you actually eat *at this kind of meal*.
 */
function deriveFrequentFoods(meals: Meal[], mealType: MealType): FoodItem[] {
  const byName: Record<string, { item: FoodItem; count: number; lastSeen: number }> = {}
  for (const m of meals) {
    if (m.type !== mealType) continue
    const ts = m.createdAt ? new Date(m.createdAt).getTime() : 0
    for (const item of m.items || []) {
      const key = (item.name || '').trim().toLowerCase()
      if (!key) continue
      // Skip pre-backfill legacy items (no classification info)
      if (item.categories === undefined) continue
      if (!byName[key]) {
        byName[key] = { item, count: 1, lastSeen: ts }
      } else {
        byName[key].count++
        if (ts >= byName[key].lastSeen) {
          byName[key].lastSeen = ts
          byName[key].item = item
        }
      }
    }
  }
  return Object.values(byName)
    .sort((a, b) => b.count - a.count || b.lastSeen - a.lastSeen)
    .slice(0, FREQUENT_LIMIT)
    .map(({ item }) => item)
}

type Stage = 'idle' | 'parsed'

interface QuickLogInputProps {
  meals: Meal[]
  onSave: (type: MealType, date: string, items: FoodItem[]) => Promise<void>
}

export function QuickLogInput({ meals, onSave }: QuickLogInputProps) {
  const [input, setInput] = useState('')
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType())
  const [stagedItems, setStagedItems] = useState<FoodItem[]>([])
  const [items, setItems] = useState<FoodItem[]>([])
  const [parsing, setParsing] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'progress' | 'success' | 'error' } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!typeMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setTypeMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [typeMenuOpen])

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    }
  }, [])

  const frequentFoods = useMemo(() => deriveFrequentFoods(meals, mealType), [meals, mealType])
  const stagedNames = useMemo(
    () => new Set(stagedItems.map((s) => s.name.trim().toLowerCase())),
    [stagedItems],
  )
  const visibleFrequent = frequentFoods.filter(
    (f) => !stagedNames.has(f.name.trim().toLowerCase()),
  )

  const preview = useMemo(() => {
    if (stage !== 'parsed' || items.length === 0) return null
    const baseReport = buildLongevityReport(meals, new Date())
    const hypothetical: Meal = {
      id: '__preview__',
      date: today,
      type: mealType,
      items,
      totalCalories: items.reduce((s, i) => s + (i.calories ?? 0), 0),
      totalProtein: items.reduce((s, i) => s + (i.protein ?? 0), 0),
      totalFiber: items.reduce((s, i) => s + (i.fiber ?? 0), 0),
      createdAt: new Date().toISOString(),
    }
    const newReport = buildLongevityReport([...meals, hypothetical], new Date())
    const before = baseReport.rollingHasData ? baseReport.rollingScore : 0
    const after = newReport.rollingScore
    return {
      before,
      after,
      delta: Math.round((after - before) * 10) / 10,
      componentChanges: componentDeltas(baseReport, newReport),
    }
  }, [stage, items, meals, today, mealType])

  const showToast = (msg: string, kind: 'progress' | 'success' | 'error', durationMs = 2500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg, kind })
    if (kind !== 'progress') {
      toastTimerRef.current = setTimeout(() => setToast(null), durationMs)
    }
  }

  const addStaged = (food: FoodItem) => {
    setStagedItems((prev) => [...prev, { ...food, id: generateId() }])
  }

  const removeStaged = (id: string) => {
    setStagedItems((prev) => prev.filter((i) => i.id !== id))
  }

  // FAST PATH — fire and forget. Parse (if text) and save in the background.
  // UI clears immediately so the user can walk away.
  const handleLogIt = () => {
    const text = input.trim()
    if (!text && stagedItems.length === 0) return

    setError(null)

    // Capture state for the background closure before resetting.
    const capturedStaged = stagedItems
    const capturedMealType = mealType
    const capturedDate = today

    // Reset visible UI right away.
    setInput('')
    setStagedItems([])
    setMealType(defaultMealType())
    setStage('idle')

    showToast('Logging…', 'progress')

    void (async () => {
      let parsedFromText: FoodItem[] = []
      if (text) {
        try {
          parsedFromText = await parseWithCache(text)
        } catch (err) {
          console.error('Parse failed:', err)
          showToast('Parse failed — please try again', 'error', 3500)
          return
        }
      }

      const allItems = [...capturedStaged, ...parsedFromText]
      if (allItems.length === 0) {
        showToast('Nothing to log', 'error', 3000)
        return
      }

      try {
        await onSave(capturedMealType, capturedDate, allItems)
        showToast(
          `Logged ${allItems.length} item${allItems.length === 1 ? '' : 's'} ✓`,
          'success',
        )
      } catch (err) {
        console.error('Save failed:', err)
        showToast('Save failed — please try again', 'error', 3500)
      }
    })()
  }

  // SLOW PATH — Evaluate. Parse foreground, show review with score preview.
  const handleEvaluate = async () => {
    if (parsing) return
    const text = input.trim()
    if (!text && stagedItems.length === 0) return

    setError(null)

    let parsedFromText: FoodItem[] = []
    if (text) {
      setParsing(true)
      try {
        parsedFromText = await parseWithCache(text)
      } catch (err) {
        console.error(err)
        setError('Parse failed. Please try again.')
        setParsing(false)
        return
      }
      setParsing(false)
    }

    const all = [...stagedItems, ...parsedFromText]
    if (all.length === 0) {
      setError('Could not parse that. Try more detail.')
      return
    }
    setItems(all)
    setStage('parsed')
  }

  const resetAll = () => {
    setInput('')
    setItems([])
    setStagedItems([])
    setStage('idle')
    setError(null)
    setMealType(defaultMealType())
  }

  // Save from the Evaluate review screen.
  const handleSaveFromReview = async () => {
    if (saving || items.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await onSave(mealType, today, items)
      const count = items.length
      resetAll()
      showToast(`Logged ${count} item${count === 1 ? '' : 's'} ✓`, 'success')
    } catch (err) {
      console.error(err)
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  // ---- Review (Evaluate) stage ----
  if (stage === 'parsed') {
    return (
      <Card className="mb-4 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">
              Previewing · {MEAL_LABELS[mealType]}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              Not saved yet — review the impact below
            </div>
          </div>
          <button
            onClick={resetAll}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 mb-3">
          {items.map((item) => (
            <div key={item.id} className="p-2.5 bg-secondary/50 rounded-md">
              <div className="text-base font-medium">{item.name}</div>
              <div className="text-sm text-muted-foreground">
                {item.calories} cal
                {item.quantity && ` · ${item.quantity}`}
              </div>
              <div className="mt-1.5">
                <CategoryChips item={item} />
              </div>
            </div>
          ))}
        </div>

        {preview && (
          <div className="mb-3 p-3 rounded-md bg-primary/5 border border-primary/10 space-y-2">
            <ScoreDeltaBlock
              label="Longevity score"
              before={preview.before}
              after={preview.after}
              delta={preview.delta}
            />
            {preview.componentChanges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {preview.componentChanges.map((c) => {
                  const isUp = c.delta > 0
                  const sign = isUp ? '+' : ''
                  const color = isUp
                    ? 'bg-quality-green/15 text-quality-green'
                    : 'bg-quality-red/15 text-quality-red'
                  return (
                    <span
                      key={c.key}
                      className={`px-2 py-0.5 rounded text-xs font-medium tabular-nums ${color}`}
                    >
                      {sign}
                      {c.delta.toFixed(1)} {c.label}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {error && <div className="mb-2 text-sm text-destructive">{error}</div>}

        <div className="flex gap-2">
          <Button onClick={handleSaveFromReview} disabled={saving} className="flex-1 h-11 text-base">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Looks good, save
          </Button>
          <Button onClick={resetAll} disabled={saving} variant="outline" className="h-11 text-base">
            Skip
          </Button>
        </div>
      </Card>
    )
  }

  // ---- Idle stage ----
  const canSubmit = (input.trim().length > 0 || stagedItems.length > 0) && !parsing

  return (
    <Card className="mb-4 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-base font-semibold">Quick log</span>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setTypeMenuOpen((v) => !v)}
            className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/70 transition-colors"
          >
            {MEAL_LABELS[mealType]}
            <ChevronDown className="w-4 h-4" />
          </button>
          {typeMenuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-popover border rounded-md shadow-md overflow-hidden min-w-[130px]">
              {MEAL_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setMealType(t)
                    setTypeMenuOpen(false)
                  }}
                  className={`block w-full text-left px-3 py-2 text-sm hover:bg-secondary ${
                    t === mealType ? 'bg-secondary/50 font-medium' : ''
                  }`}
                >
                  {MEAL_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`mb-3 px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
            toast.kind === 'success'
              ? 'bg-quality-green/10 text-quality-green'
              : toast.kind === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary'
          }`}
        >
          {toast.kind === 'progress' && <Loader2 className="w-4 h-4 animate-spin" />}
          {toast.msg}
        </div>
      )}

      <Textarea
        placeholder="e.g., 2 eggs, oatmeal with berries, coffee"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={parsing}
        className="min-h-[70px] text-base mb-3"
      />

      {visibleFrequent.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
            Your usual {MEAL_LABELS[mealType].toLowerCase()}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {visibleFrequent.map((food, i) => (
              <button
                key={`${food.name}-${i}`}
                onClick={() => addStaged(food)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary text-foreground text-sm font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {food.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {stagedItems.length > 0 && (
        <div className="mb-3 p-2.5 rounded-md bg-primary/5 border border-primary/10">
          <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
            Ready to log ({stagedItems.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stagedItems.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary/15 text-primary text-sm font-medium"
              >
                {item.name}
                <button
                  onClick={() => removeStaged(item.id)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <div className="mb-2 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={handleLogIt}
          disabled={!canSubmit}
          className="h-11 text-base"
        >
          <Utensils className="w-4 h-4 mr-2" />
          Log it
        </Button>
        <Button
          onClick={handleEvaluate}
          disabled={!canSubmit}
          variant="outline"
          className="h-11 text-base"
        >
          {parsing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Eye className="w-4 h-4 mr-2" />
          )}
          Evaluate
        </Button>
      </div>
    </Card>
  )
}

function ScoreDeltaBlock({
  label,
  before,
  after,
  delta,
}: {
  label: string
  before: number
  after: number
  delta: number
}) {
  const sign = delta > 0 ? '+' : ''
  const color =
    delta > 0.5
      ? 'text-quality-green'
      : delta < -0.5
      ? 'text-quality-red'
      : 'text-muted-foreground'
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="flex items-baseline gap-1.5 tabular-nums mt-1">
        <span className="text-base text-muted-foreground">{Math.round(before)}</span>
        <span className="text-sm text-muted-foreground">→</span>
        <span className="text-xl font-bold">{Math.round(after)}</span>
        <span className={`text-sm font-semibold ${color}`}>
          {sign}
          {delta.toFixed(1)}
        </span>
      </div>
    </div>
  )
}
