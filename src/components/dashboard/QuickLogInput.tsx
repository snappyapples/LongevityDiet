'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { Loader2, Sparkles, Utensils, Eye, Check, X, ChevronDown } from 'lucide-react'
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

function defaultMealType(now: Date = new Date()): MealType {
  const h = now.getHours() + now.getMinutes() / 60
  if (h >= 4 && h < 10.5) return 'breakfast'
  if (h >= 10.5 && h < 15) return 'lunch'
  if (h >= 15 && h < 20.5) return 'dinner'
  return 'snack'
}

type Stage = 'idle' | 'parsed'
type Intent = 'log' | 'evaluate'

interface QuickLogInputProps {
  meals: Meal[]
  onSave: (type: MealType, date: string, items: FoodItem[]) => Promise<void>
}

export function QuickLogInput({ meals, onSave }: QuickLogInputProps) {
  const [input, setInput] = useState('')
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType())
  const [items, setItems] = useState<FoodItem[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  const handleParse = async (withIntent: Intent) => {
    if (!input.trim() || parsing) return
    setError(null)
    setIntent(withIntent)
    setParsing(true)
    try {
      const items = await parseWithCache(input)
      if (items.length > 0) {
        setItems(items)
        setStage('parsed')
      } else {
        setError('Could not parse that. Try more detail.')
      }
    } catch (err) {
      console.error(err)
      setError('Parse failed. Please try again.')
    } finally {
      setParsing(false)
    }
  }

  const resetAll = () => {
    setInput('')
    setItems([])
    setStage('idle')
    setIntent(null)
    setError(null)
    setMealType(defaultMealType())
  }

  const handleSave = async () => {
    if (saving || items.length === 0) return
    setSaving(true)
    setError(null)
    try {
      await onSave(mealType, today, items)
      resetAll()
    } catch (err) {
      console.error(err)
      setError('Failed to save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (stage === 'parsed') {
    const isEval = intent === 'evaluate'
    return (
      <Card className="mb-4 p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">
              {isEval ? 'Previewing' : 'Logging'} · {MEAL_LABELS[mealType]}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {isEval ? 'Not saved yet — review the impact below' : 'Review before saving'}
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
          <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 text-base">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {isEval ? 'Looks good, save' : 'Save'}
          </Button>
          <Button onClick={resetAll} disabled={saving} variant="outline" className="h-11 text-base">
            {isEval ? 'Skip' : 'Cancel'}
          </Button>
        </div>
      </Card>
    )
  }

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

      <Textarea
        placeholder="e.g., 2 eggs, oatmeal with berries, coffee"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        disabled={parsing}
        className="min-h-[70px] text-base mb-2"
      />

      {error && <div className="mb-2 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => handleParse('log')}
          disabled={!input.trim() || parsing}
          className="h-11 text-base"
        >
          {parsing && intent === 'log' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Utensils className="w-4 h-4 mr-2" />
          )}
          Log it
        </Button>
        <Button
          onClick={() => handleParse('evaluate')}
          disabled={!input.trim() || parsing}
          variant="outline"
          className="h-11 text-base"
        >
          {parsing && intent === 'evaluate' ? (
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
