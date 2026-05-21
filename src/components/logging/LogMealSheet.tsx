'use client'

import { useState, useEffect } from 'react'
import { Loader2, Sparkles, Trash2, Pencil, Check, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { FoodItem, MealType, MealContext, Meal } from '@/types'
import { CategoryChips } from '@/components/dashboard/CategoryChips'
import { parseWithCache } from '@/lib/parse-cache'

const mealLabels: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  indulgence: 'Indulgence',
}

// Editable food item component
function EditableFoodItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: FoodItem
  onUpdate: (updated: FoodItem) => void
  onRemove: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedItem, setEditedItem] = useState(item)

  const handleSave = () => {
    onUpdate(editedItem)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedItem(item)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="p-2 bg-secondary rounded-lg space-y-2">
        <Input
          value={editedItem.name}
          onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })}
          placeholder="Food name"
          className="font-medium h-8 text-sm"
        />
        <div className="grid grid-cols-4 gap-1.5">
          <div>
            <label className="text-xs text-muted-foreground">Cal</label>
            <Input
              type="number"
              value={editedItem.calories}
              onChange={(e) => setEditedItem({ ...editedItem, calories: parseInt(e.target.value) || 0 })}
              className="text-sm h-8"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Protein</label>
            <Input
              type="number"
              value={editedItem.protein}
              onChange={(e) => setEditedItem({ ...editedItem, protein: parseInt(e.target.value) || 0 })}
              className="text-sm h-8"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fiber</label>
            <Input
              type="number"
              value={editedItem.fiber}
              onChange={(e) => setEditedItem({ ...editedItem, fiber: parseInt(e.target.value) || 0 })}
              className="text-sm h-8"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Qty</label>
            <Input
              value={editedItem.quantity || ''}
              onChange={(e) => setEditedItem({ ...editedItem, quantity: e.target.value })}
              placeholder="1 cup"
              className="text-sm h-8"
            />
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" onClick={handleSave} className="flex-1 h-7 text-xs">
            <Check className="w-3 h-3 mr-1" /> Save
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} className="flex-1 h-7 text-xs">
            <X className="w-3 h-3 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between p-2 bg-secondary rounded-lg">
      <div className="flex-1 cursor-pointer" onClick={() => setIsEditing(true)}>
        <p className="font-medium text-sm">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.calories} cal · {item.protein}g P · {item.fiber}g F
          {item.quantity && ` · ${item.quantity}`}
        </p>
        <div className="mt-1">
          <CategoryChips item={item} />
        </div>
      </div>
      <div className="flex">
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 hover:bg-primary/10 rounded text-muted-foreground hover:text-primary transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

interface LogMealSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mealType: MealType | null
  editingMeal: Meal | null
  onSave: (items: FoodItem[], context: MealContext) => Promise<void>
}

export function LogMealSheet({ open, onOpenChange, mealType, editingMeal, onSave }: LogMealSheetProps) {
  const [input, setInput] = useState('')
  const [items, setItems] = useState<FoodItem[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notes, setNotes] = useState('')

  // Reset or populate form when sheet opens
  useEffect(() => {
    if (open) {
      if (editingMeal) {
        setItems(editingMeal.items)
        setNotes(editingMeal.context?.notes || '')
      } else {
        setItems([])
        setNotes('')
      }
      setInput('')
    }
  }, [open, editingMeal])

  const isEditing = !!editingMeal

  const handleParse = async () => {
    if (!input.trim()) return
    setParsing(true)
    try {
      const parsed = await parseWithCache(input)
      if (parsed.length > 0) {
        setItems((prev) => [...prev, ...parsed])
        setInput('')
      }
    } catch (err) {
      console.error('Failed to parse meal:', err)
    } finally {
      setParsing(false)
    }
  }

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id))
  }

  const handleUpdateItem = (updated: FoodItem) => {
    setItems(items.map((item) => (item.id === updated.id ? updated : item)))
  }

  const handleSave = async () => {
    if (items.length === 0) return
    setSaving(true)
    try {
      const context: MealContext = notes.trim() ? { notes: notes.trim() } : {}
      await onSave(items, context)
      setItems([])
      setInput('')
      setNotes('')
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to save meal:', err)
    } finally {
      setSaving(false)
    }
  }

  const totalCalories = items.reduce((sum, i) => sum + i.calories, 0)
  const totalProtein = items.reduce((sum, i) => sum + i.protein, 0)
  const totalFiber = items.reduce((sum, i) => sum + i.fiber, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col max-w-lg mx-auto">
        <SheetHeader className="px-4">
          <SheetTitle>
            {isEditing ? 'Edit' : 'Log'} {mealType ? mealLabels[mealType] : 'Meal'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2 px-4">
          {/* Natural language input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">What did you eat?</label>
            <Textarea
              placeholder="e.g., Chicken breast, 1 cup broccoli, half cup rice"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[70px]"
            />
            <Button
              onClick={handleParse}
              disabled={!input.trim() || parsing}
              className="w-full"
              size="sm"
            >
              {parsing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Parse with AI
            </Button>
          </div>

          {/* Parsed items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Items</label>
                <span className="text-sm text-muted-foreground">
                  {totalCalories} cal · {totalProtein}g P · {totalFiber}g F
                </span>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <EditableFoodItem
                    key={item.id}
                    item={item}
                    onUpdate={handleUpdateItem}
                    onRemove={() => handleRemoveItem(item.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Save + optional notes */}
          <div className="space-y-3">
            <Button
              onClick={handleSave}
              disabled={items.length === 0 || saving}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
              {isEditing ? 'Update' : 'Save'} {mealType ? mealLabels[mealType] : 'Meal'}
            </Button>

            <Input
              placeholder="Notes (optional)…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
