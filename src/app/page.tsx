'use client'

import { Dashboard } from '@/components/dashboard/Dashboard'
import { Logo } from '@/components/Logo'
import { SettingsSheet } from '@/components/settings/SettingsSheet'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useAuth } from '@/components/auth/AuthProvider'
import { Button } from '@/components/ui/button'

function HomeContent() {
  const { signOut, user } = useAuth()

  return (
    <main className="min-h-screen max-w-lg mx-auto">
      {/* Header with nutrition green gradient */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-nutrition-green-dark to-nutrition-green p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <Logo size="md" className="text-white [&_span]:text-white" />
            <p className="text-xs text-white/80 mt-0.5">Fuel Well. Move More. Love the Results.</p>
          </div>
          <div className="flex items-center gap-2">
            <SettingsSheet />
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-white hover:bg-white/20 text-xs"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4">
        <Dashboard />
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <AuthGuard>
      <HomeContent />
    </AuthGuard>
  )
}
