'use client'

import { useState } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { DayData, LongevityDailyScore, Meal, MealType } from '@/types'
import { MealRow, EmptyMealSlot } from './MealRow'
import { LongevityScoreRing } from './LongevityScoreRing'
import { LongevitySubscoreBar } from './LongevitySubscoreBar'

const SINGLE_MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']
const MULTI_MEAL_TYPES: MealType[] = ['snack', 'indulgence']

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'EEEE, MMM d')
}

interface Props {
  data: DayData
  score: LongevityDailyScore
  defaultExpanded?: boolean
  onLogMeal: (type: MealType, date: string) => void
  onEditMeal: (meal: Meal) => void
  onDeleteMeal: (mealId: string) => void
}

export function LongevityDayCard({
  data,
  score,
  defaultExpanded = false,
  onLogMeal,
  onEditMeal,
  onDeleteMeal,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const getMealsByType = (type: MealType) => data.meals.filter((m) => m.type === type)
  const getFirstMealByType = (type: MealType) => data.meals.find((m) => m.type === type)

  if (!expanded) {
    return (
      <Card
        className="cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center justify-between p-3 pr-4">
          <div className="flex-1">
            <h3 className="font-semibold text-base">{formatDateLabel(data.date)}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {score.hasData
                ? `${data.meals.length} meal${data.meals.length === 1 ? '' : 's'} · ${Math.round(data.totalProtein)}g protein`
                : 'No meals logged'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LongevityScoreRing score={score.totalScore} hasData={score.hasData} size={56} strokeWidth={5} />
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setExpanded(false)}
        className="w-full flex items-center justify-between p-3 pr-4 hover:bg-secondary/30 transition-colors border-b"
      >
        <div className="flex-1 text-left">
          <h3 className="font-medium">{formatDateLabel(data.date)}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {score.hasData ? `${data.meals.length} meal${data.meals.length === 1 ? '' : 's'}` : 'No meals logged'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LongevityScoreRing score={score.totalScore} hasData={score.hasData} size={56} strokeWidth={5} />
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        </div>
      </button>

      <div className="p-4 space-y-4">
        {/* Subscores */}
        {score.hasData && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <LongevitySubscoreBar label="Plants" score={score.subscores.plants} />
            <LongevitySubscoreBar label="Fat Quality" score={score.subscores.fatQuality} />
            <LongevitySubscoreBar label="Protein (fish)" score={score.subscores.proteinQuality} />
            <LongevitySubscoreBar label="Harm Reduction" score={score.subscores.harmReduction} />
          </div>
        )}

        {/* Meal rows */}
        <div className="space-y-2">
          {SINGLE_MEAL_TYPES.map((type) => {
            const meal = getFirstMealByType(type)
            if (meal) {
              return <MealRow key={meal.id} meal={meal} onEdit={onEditMeal} onDelete={onDeleteMeal} />
            }
            return (
              <EmptyMealSlot
                key={type}
                type={type}
                onLog={() => onLogMeal(type, data.date)}
              />
            )
          })}

          {MULTI_MEAL_TYPES.map((type) => {
            const meals = getMealsByType(type)
            return (
              <div key={type} className="space-y-2">
                {meals.map((meal) => (
                  <MealRow key={meal.id} meal={meal} onEdit={onEditMeal} onDelete={onDeleteMeal} />
                ))}
                <EmptyMealSlot type={type} onLog={() => onLogMeal(type, data.date)} />
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
