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

const hungerDescriptions: Record<number, string> = {
  1: 'Not hungry - eating for other reasons',
  2: 'Slightly hungry - could wait a bit longer',
  3: 'Moderately hungry - ideal time to eat',
  4: 'Very hungry - strong hunger signals',
  5: 'Starving - overly hungry, may lead to overeating',
}

const stressDescriptions: Record<number, string> = {
  1: 'Not calm - overwhelmed or very stressed',
  2: 'Slightly calm - significant tension',
  3: 'Moderately calm - some pressure',
  4: 'Quite calm - minor tension',
  5: 'Very calm - relaxed and at ease',
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
  hideMindfulness?: boolean
}

export function LogMealSheet({ open, onOpenChange, mealType, editingMeal, onSave, hideMindfulness = false }: LogMealSheetProps) {
  const [input, setInput] = useState('')
  const [items, setItems] = useState<FoodItem[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [context, setContext] = useState<MealContext>({
    hungerLevel: undefined,
    stressLevel: undefined,
    ateWithOthers: false,
    notes: '',
  })

  // Reset or populate form when sheet opens
  useEffect(() => {
    if (open) {
      if (editingMeal) {
        // Editing existing meal - populate form
        setItems(editingMeal.items)
        setContext(editingMeal.context || {
          hungerLevel: undefined,
          stressLevel: undefined,
          ateWithOthers: false,
          notes: '',
        })
      } else {
        // New meal - reset form
        setItems([])
        setContext({
          hungerLevel: undefined,
          stressLevel: undefined,
          ateWithOthers: false,
          notes: '',
        })
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
        setItems(prev => [...prev, ...parsed])
        setInput('')
      }
    } catch (err) {
      console.error('Failed to parse meal:', err)
    } finally {
      setParsing(false)
    }
  }

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleUpdateItem = (updated: FoodItem) => {
    setItems(items.map(item => item.id === updated.id ? updated : item))
  }

  const handleSave = async () => {
    if (items.length === 0) return
    setSaving(true)
    try {
      await onSave(items, context)
      setItems([])
      setInput('')
      setContext({ hungerLevel: undefined, stressLevel: undefined, ateWithOthers: false, notes: '' })
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

          {/* Context inputs */}
          <div className="space-y-3">
            {!hideMindfulness && (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Hunger Level <span className="text-destructive">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setContext({ ...context, hungerLevel: level })}
                        className={`flex-1 py-2 text-sm rounded-md border transition-colors ${
                          context.hungerLevel === level
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-secondary'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground min-h-[1rem]">
                    {context.hungerLevel ? hungerDescriptions[context.hungerLevel] : 'Select your hunger level before eating'}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Calm Level <span className="text-destructive">*</span>
                  </label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setContext({ ...context, stressLevel: level })}
                        className={`flex-1 py-2 text-sm rounded-md border transition-colors ${
                          context.stressLevel === level
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-secondary'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground min-h-[1rem]">
                    {context.stressLevel ? stressDescriptions[context.stressLevel] : 'Select your calm level at mealtime'}
                  </p>
                </div>
              </>
            )}

            {/* Save button - moved up for accessibility */}
            <Button
              onClick={handleSave}
              disabled={
                items.length === 0 ||
                saving ||
                (!hideMindfulness && (context.hungerLevel === undefined || context.stressLevel === undefined))
              }
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : null}
              {isEditing ? 'Update' : 'Save'} {mealType ? mealLabels[mealType] : 'Meal'}
            </Button>

            {!hideMindfulness && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setContext({ ...context, ateWithOthers: !context.ateWithOthers })}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    context.ateWithOthers
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary'
                  }`}
                >
                  Ate with others
                </button>
                <Input
                  placeholder="Notes..."
                  value={context.notes || ''}
                  onChange={(e) => setContext({ ...context, notes: e.target.value })}
                  className="flex-1 h-8 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
