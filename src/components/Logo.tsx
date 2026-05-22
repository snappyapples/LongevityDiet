'use client'

import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const sizes = {
    sm: { icon: 24, text: 'text-lg' },
    md: { icon: 32, text: 'text-xl' },
    lg: { icon: 48, text: 'text-3xl' },
  }

  const { icon, text } = sizes[size]

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Tree-rings mark — concentric circles, centers nudged down-right for an organic look */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Cross-section disc */}
        <circle cx="24" cy="24" r="22" fill="url(#discGradient)" />
        {/* Bark / outer rim */}
        <circle cx="24" cy="24" r="22" fill="none" stroke="#2E7D32" strokeWidth="0.6" strokeOpacity="0.55" />
        {/* Growth rings */}
        <circle cx="23" cy="23" r="17.5" fill="none" stroke="#1B5E20" strokeWidth="0.9" strokeOpacity="0.5" />
        <circle cx="23.4" cy="23.4" r="13" fill="none" stroke="#1B5E20" strokeWidth="1" strokeOpacity="0.65" />
        <circle cx="23.8" cy="23.8" r="8.5" fill="none" stroke="#1B5E20" strokeWidth="1.1" strokeOpacity="0.78" />
        <circle cx="24.2" cy="24.2" r="4.5" fill="none" stroke="#1B5E20" strokeWidth="1.2" strokeOpacity="0.9" />
        {/* Heart of the tree */}
        <circle cx="24.4" cy="24.4" r="1.5" fill="#1B5E20" />
        <defs>
          <radialGradient id="discGradient" cx="38%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#C5E1A5" />
            <stop offset="60%" stopColor="#81C784" />
            <stop offset="100%" stopColor="#4CAF50" />
          </radialGradient>
        </defs>
      </svg>

      {showText && (
        <span className={cn('font-bold tracking-tight', text)}>
          <span className="text-nutrition-green-dark">Longevity</span>
          <span className="text-nutrition-green"> Diet</span>
        </span>
      )}
    </div>
  )
}
