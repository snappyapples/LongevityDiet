'use client'

import { LongevityDashboard } from './LongevityDashboard'

// Longevity is now the only mode. The wrapper exists so consumers
// (src/app/page.tsx) keep using <Dashboard /> as the entry point.
export function Dashboard() {
  return <LongevityDashboard />
}
