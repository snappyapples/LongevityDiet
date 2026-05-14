'use client'

import { Plus, Coffee, Sun, Moon, Cookie, Cake, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { MealType } from '@/types'
import { cn } from '@/lib/utils'

interface FloatingAddButtonProps {
  onSelectMeal: (type: MealType, date: string) => void
  defaultDate: string
  onAskCoach?: () => void
}

const options: { type: MealType; icon: React.ReactNode; label: string }[] = [
  { type: 'breakfast', icon: <Coffee className="w-5 h-5" />, label: 'Breakfast' },
  { type: 'lunch', icon: <Sun className="w-5 h-5" />, label: 'Lunch' },
  { type: 'dinner', icon: <Moon className="w-5 h-5" />, label: 'Dinner' },
  { type: 'snack', icon: <Cookie className="w-5 h-5" />, label: 'Snack' },
  { type: 'indulgence', icon: <Cake className="w-5 h-5" />, label: 'Indulgence' },
]

export function FloatingAddButton({ onSelectMeal, defaultDate, onAskCoach }: FloatingAddButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-16 right-0 flex flex-col-reverse gap-2 mb-2">
            {options.map((opt, i) => (
              <button
                key={opt.type}
                onClick={() => {
                  onSelectMeal(opt.type, defaultDate)
                  setOpen(false)
                }}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 bg-card border rounded-full shadow-lg',
                  'hover:bg-secondary transition-all',
                  'animate-in fade-in slide-in-from-bottom-2',
                )}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="text-muted-foreground">{opt.icon}</span>
                <span className="font-medium whitespace-nowrap">{opt.label}</span>
              </button>
            ))}

            {onAskCoach && (
              <button
                onClick={() => {
                  onAskCoach()
                  setOpen(false)
                }}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground rounded-full shadow-lg',
                  'hover:opacity-90 transition-all',
                  'animate-in fade-in slide-in-from-bottom-2',
                )}
                style={{ animationDelay: `${options.length * 50}ms` }}
              >
                <Sparkles className="w-5 h-5" />
                <span className="font-medium whitespace-nowrap">Ask coach</span>
              </button>
            )}
          </div>
        </>
      )}

      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg',
          'flex items-center justify-center',
          'hover:scale-105 active:scale-95 transition-transform',
        )}
      >
        {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  )
}
