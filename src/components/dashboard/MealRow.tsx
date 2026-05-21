'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Coffee, Sun, Moon, Cookie, Cake, Pencil, Trash2 } from 'lucide-react'
import { Meal, MealType } from '@/types'
import { cn } from '@/lib/utils'
import { CategoryChips } from './CategoryChips'

const mealIcons: Record<MealType, React.ReactNode> = {
  breakfast: <Coffee className="w-4 h-4" />,
  lunch: <Sun className="w-4 h-4" />,
  dinner: <Moon className="w-4 h-4" />,
  snack: <Cookie className="w-4 h-4" />,
  indulgence: <Cake className="w-4 h-4" />,
}

const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  indulgence: 'Indulgence',
}

interface MealRowProps {
  meal: Meal
  onEdit: (meal: Meal) => void
  onDelete: (mealId: string) => void
}

export function MealRow({ meal, onEdit, onDelete }: MealRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(meal)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirmDelete) {
      onDelete(meal.id)
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
      // Auto-reset after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{mealIcons[meal.type]}</span>
          <span className="font-semibold text-base">{mealLabels[meal.type]}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground font-medium">{meal.totalCalories} cal</span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t bg-secondary/30 p-3 space-y-1.5">
          {meal.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-base py-1.5">
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">
                  {item.name}
                  {item.quantity && (
                    <span className="text-muted-foreground ml-1 text-sm font-normal">({item.quantity})</span>
                  )}
                </div>
                <div className="mt-1.5">
                  <CategoryChips item={item} />
                </div>
              </div>
              <span className="text-muted-foreground text-right text-sm whitespace-nowrap pt-0.5">{item.calories} cal</span>
            </div>
          ))}
          {meal.context?.notes && (
            <p className="text-sm text-muted-foreground italic mt-2 pt-2 border-t">
              {meal.context.notes}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t">
            <button
              onClick={handleEdit}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground py-1"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className={cn(
                'flex items-center gap-2 text-sm font-medium py-1',
                confirmDelete
                  ? 'text-red-500'
                  : 'text-muted-foreground hover:text-red-500',
              )}
            >
              <Trash2 className="w-4 h-4" />
              {confirmDelete ? 'Tap again to delete' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface EmptyMealSlotProps {
  type: MealType
  onLog: () => void
}

export function EmptyMealSlot({ type, onLog }: EmptyMealSlotProps) {
  return (
    <button
      onClick={onLog}
      className="w-full flex items-center justify-between p-3 border border-dashed rounded-lg hover:bg-secondary/50 transition-colors text-muted-foreground"
    >
      <div className="flex items-center gap-3">
        <span>{mealIcons[type]}</span>
        <span className="text-base">{mealLabels[type]}</span>
      </div>
      <span className="text-sm font-medium">+ Log</span>
    </button>
  )
}
