'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { isToday, format, subDays } from 'date-fns'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { FloatingAddButton } from '../FloatingAddButton'
import { LogMealSheet } from '../logging/LogMealSheet'
import { LongevityScoreRing } from './LongevityScoreRing'
import { LongevityDayCard } from './LongevityDayCard'
import { LongevityHelpSheet } from './LongevityHelpSheet'
import { LongevityComponentList } from './LongevityComponentList'
import { ProteinRail } from './ProteinRail'
import { QuickLogInput } from './QuickLogInput'
import { CoachSheet } from '@/components/coach/CoachSheet'
import { useSettings } from '@/components/settings/SettingsSheet'
import type { DayData, FoodItem, Meal, MealContext, MealType } from '@/types'
import { buildLongevityReport } from '@/lib/longevity-score'
import { cn } from '@/lib/utils'

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs text-muted-foreground">No prior week data</span>
  }
  const isUp = delta > 0.5
  const isDown = delta < -0.5
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus
  const color = isUp ? 'text-quality-green' : isDown ? 'text-quality-red' : 'text-muted-foreground'
  const sign = delta > 0 ? '+' : ''
  return (
    <div className={cn('flex items-center gap-1 text-sm font-medium', color)}>
      <Icon className="w-4 h-4" />
      <span>
        {sign}
        {delta.toFixed(1)} vs previous 7 days
      </span>
    </div>
  )
}

function buildDays(meals: Meal[], today: Date, numDays: number): DayData[] {
  const out: DayData[] = []
  for (let i = 0; i < numDays; i++) {
    const dateStr = format(subDays(today, i), 'yyyy-MM-dd')
    const dayMeals = meals.filter((m) => m.date === dateStr)
    const totalCalories = dayMeals.reduce((s, m) => s + (m.totalCalories ?? 0), 0)
    const totalProtein = dayMeals.reduce((s, m) => s + (m.totalProtein ?? 0), 0)
    const totalFiber = dayMeals.reduce((s, m) => s + (m.totalFiber ?? 0), 0)
    out.push({
      date: dateStr,
      meals: dayMeals,
      totalCalories,
      totalProtein,
      totalFiber,
      proteinPerCalorie: totalCalories > 0 ? totalProtein / totalCalories : 0,
      fiberPerCalorie: totalCalories > 0 ? totalFiber / totalCalories : 0,
    })
  }
  return out
}

function makeTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function totalsFromItems(items: FoodItem[]) {
  return {
    totalCalories: items.reduce((s, i) => s + (i.calories ?? 0), 0),
    totalProtein: items.reduce((s, i) => s + (i.protein ?? 0), 0),
    totalFiber: items.reduce((s, i) => s + (i.fiber ?? 0), 0),
  }
}

export function LongevityDashboard() {
  const settings = useSettings()
  const [allMeals, setAllMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null)
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [coachOpen, setCoachOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const today = format(new Date(), 'yyyy-MM-dd')
      // Fetch 30 days. Last 14 power the score (current 7 + prior 7); the
      // additional history feeds the QuickLogInput's frequent-foods pills.
      const res = await fetch(`/api/meals?days=30&today=${today}`)
      if (!res.ok) throw new Error('Failed to fetch meals')
      const data = await res.json()
      const allDays: DayData[] = data.days || []
      const flattened: Meal[] = allDays.flatMap((d) => d.meals)
      setAllMeals(flattened)
    } catch (err) {
      console.error('Failed to fetch longevity data:', err)
      setError('Failed to load data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Derive everything else from allMeals — no separate state required.
  // Re-runs only when meals change (optimistic add/update/delete or initial fetch).
  const report = useMemo(() => buildLongevityReport(allMeals, new Date()), [allMeals])
  const days = useMemo(() => buildDays(allMeals, new Date(), 7), [allMeals])
  const scoresByDate = useMemo(
    () => new Map(report.dailyScores.map((s) => [s.date, s])),
    [report],
  )

  const handleLogMeal = (type: MealType, date: string) => {
    setEditingMeal(null)
    setSelectedMealType(type)
    setSelectedDate(date)
    setSheetOpen(true)
  }

  const handleEditMeal = (meal: Meal) => {
    setEditingMeal(meal)
    setSelectedMealType(meal.type)
    setSheetOpen(true)
  }

  // Optimistic delete: remove locally, fire DELETE in background, restore on failure.
  const handleDeleteMeal = (mealId: string) => {
    setError(null)
    const removed = allMeals.find((m) => m.id === mealId)
    if (!removed) return
    setAllMeals((prev) => prev.filter((m) => m.id !== mealId))
    void (async () => {
      try {
        const res = await fetch(`/api/meals?id=${mealId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Failed to delete meal')
      } catch (err) {
        console.error('Failed to delete meal:', err)
        // Restore the meal
        setAllMeals((prev) => [...prev, removed])
        setError('Failed to delete meal. Please try again.')
      }
    })()
  }

  // Optimistic create or update from the LogMealSheet.
  const handleSaveMeal = async (items: FoodItem[], context: MealContext) => {
    if (!selectedMealType) return
    setError(null)

    if (editingMeal) {
      // Optimistic update — replace in place.
      const totals = totalsFromItems(items)
      const updated: Meal = {
        ...editingMeal,
        type: selectedMealType,
        items,
        context,
        ...totals,
      }
      const previous = editingMeal
      setAllMeals((prev) => prev.map((m) => (m.id === editingMeal.id ? updated : m)))
      setEditingMeal(null)
      void (async () => {
        try {
          const res = await fetch('/api/meals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: editingMeal.id,
              type: selectedMealType,
              date: editingMeal.date,
              items,
              context,
            }),
          })
          if (!res.ok) throw new Error('Failed to update meal')
          const data = await res.json()
          if (data?.meal) {
            setAllMeals((prev) =>
              prev.map((m) => (m.id === editingMeal.id ? (data.meal as Meal) : m)),
            )
          }
        } catch (err) {
          console.error('Failed to update meal:', err)
          // Roll back to previous
          setAllMeals((prev) => prev.map((m) => (m.id === previous.id ? previous : m)))
          setError('Failed to update meal. Please try again.')
        }
      })()
    } else {
      // Optimistic create — add with temp id, swap to server-returned meal on success.
      const mealDate = selectedDate || format(new Date(), 'yyyy-MM-dd')
      const tempId = makeTempId()
      const totals = totalsFromItems(items)
      const optimistic: Meal = {
        id: tempId,
        type: selectedMealType,
        date: mealDate,
        items,
        context,
        ...totals,
        createdAt: new Date().toISOString(),
      }
      setAllMeals((prev) => [...prev, optimistic])
      void (async () => {
        try {
          const res = await fetch('/api/meals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: selectedMealType,
              date: mealDate,
              items,
              context,
            }),
          })
          if (!res.ok) throw new Error('Failed to save meal')
          const data = await res.json()
          if (data?.meal) {
            setAllMeals((prev) => prev.map((m) => (m.id === tempId ? (data.meal as Meal) : m)))
          }
        } catch (err) {
          console.error('Failed to save meal:', err)
          // Remove the optimistic meal
          setAllMeals((prev) => prev.filter((m) => m.id !== tempId))
          setError('Failed to save meal. Please try again.')
        }
      })()
    }
  }

  // Optimistic create from QuickLogInput (no edit path here).
  const handleQuickSave = async (type: MealType, date: string, items: FoodItem[]) => {
    setError(null)
    const tempId = makeTempId()
    const totals = totalsFromItems(items)
    const optimistic: Meal = {
      id: tempId,
      type,
      date,
      items,
      context: {},
      ...totals,
      createdAt: new Date().toISOString(),
    }
    setAllMeals((prev) => [...prev, optimistic])
    void (async () => {
      try {
        const res = await fetch('/api/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, date, items, context: {} }),
        })
        if (!res.ok) throw new Error('Failed to save meal')
        const data = await res.json()
        if (data?.meal) {
          setAllMeals((prev) => prev.map((m) => (m.id === tempId ? (data.meal as Meal) : m)))
        }
      } catch (err) {
        console.error('Failed to save meal:', err)
        setAllMeals((prev) => prev.filter((m) => m.id !== tempId))
        setError('Failed to save meal. Please try again.')
      }
    })()
  }

  const handleSheetClose = (open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setEditingMeal(null)
      setSelectedDate(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Loading longevity score...</span>
        </div>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      <Card className="mb-4 p-5">
        <div className="flex items-center gap-5">
          <LongevityScoreRing
            score={report.rollingScore}
            hasData={report.rollingHasData}
            size={140}
            strokeWidth={12}
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Longevity Score
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Rolling 7-day window
                </div>
              </div>
              <LongevityHelpSheet />
            </div>
            <DeltaBadge delta={report.weeklyDelta} />
          </div>
        </div>

        <ProteinRail meals={allMeals} weightLbs={settings.weight} />

        <LongevityComponentList report={report} />
      </Card>

      <QuickLogInput meals={allMeals} onSave={handleQuickSave} />

      <div className="space-y-4 pb-24">
        {days.map((day) => {
          const dayScore = scoresByDate.get(day.date)
          if (!dayScore) return null
          return (
            <LongevityDayCard
              key={day.date}
              data={day}
              score={dayScore}
              defaultExpanded={isToday(new Date(day.date + 'T00:00:00'))}
              onLogMeal={handleLogMeal}
              onEditMeal={handleEditMeal}
              onDeleteMeal={handleDeleteMeal}
            />
          )
        })}

        {days.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-medium">No meals logged yet</p>
            <p className="text-sm">Tap the + button to log your first meal</p>
          </div>
        )}
      </div>

      <FloatingAddButton
        onSelectMeal={handleLogMeal}
        defaultDate={format(new Date(), 'yyyy-MM-dd')}
        onAskCoach={() => setCoachOpen(true)}
      />

      <LogMealSheet
        open={sheetOpen}
        onOpenChange={handleSheetClose}
        mealType={selectedMealType}
        editingMeal={editingMeal}
        onSave={handleSaveMeal}
        hideMindfulness
      />

      <CoachSheet
        open={coachOpen}
        onOpenChange={setCoachOpen}
        report={report}
        meals={allMeals}
        weightLbs={settings.weight}
      />
    </>
  )
}
