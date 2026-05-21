'use client'

import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DEFAULT_PROTEIN_MULTIPLIER, getProteinTarget } from '@/lib/protein-target'

export interface UserSettings {
  weight: number
}

const defaultSettings: UserSettings = {
  weight: 180,
}

export function SettingsSheet() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setSettings({ weight: data.weight ?? defaultSettings.weight }))
      .catch(console.error)
  }, [])

  const saveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      window.dispatchEvent(new Event('settingsUpdated'))
      setOpen(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const proteinTarget = getProteinTarget(settings.weight, DEFAULT_PROTEIN_MULTIPLIER)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <Settings className="w-5 h-5 text-white" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto max-h-[60vh] flex flex-col max-w-lg mx-auto">
        <SheetHeader className="px-4">
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-4 px-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="weight-input">
              Weight (lbs)
            </label>
            <Input
              id="weight-input"
              type="number"
              value={settings.weight || ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  weight: e.target.value === '' ? 0 : parseInt(e.target.value),
                })
              }
              className="h-10"
              min={1}
            />
            <p className="text-xs text-muted-foreground">
              Used to compute your daily protein target ({DEFAULT_PROTEIN_MULTIPLIER} g/lb ={' '}
              <span className="font-medium text-foreground">{proteinTarget} g/day</span>).
            </p>
          </div>
        </div>

        <div className="pt-2 border-t px-4 pb-3">
          <Button onClick={saveSettings} className="w-full">
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Hook used by other components that need access to settings (e.g. ProteinRail, CoachSheet)
export function useSettings(): UserSettings {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)

  useEffect(() => {
    const load = () => {
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => setSettings({ weight: data.weight ?? defaultSettings.weight }))
        .catch(console.error)
    }

    load()
    window.addEventListener('settingsUpdated', load)
    return () => window.removeEventListener('settingsUpdated', load)
  }, [])

  return settings
}
