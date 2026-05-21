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
      {/* Logo Icon - Heart with leaf/growth element */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Heart shape - nutrition green */}
        <path
          d="M24 42C24 42 6 28 6 16C6 10 10.5 6 16 6C19.5 6 22.5 8 24 11C25.5 8 28.5 6 32 6C37.5 6 42 10 42 16C42 28 24 42 24 42Z"
          fill="url(#heartGradient)"
        />
        {/* Leaf/growth element inside heart - lighter green */}
        <path
          d="M24 34C24 34 18 26 18 22C18 18 21 16 24 16C27 16 30 18 30 22C30 26 24 34 24 34Z"
          fill="url(#leafGradient)"
        />
        {/* Stem */}
        <path
          d="M24 34V38"
          stroke="#1B5E20"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="heartGradient" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4CAF50" />
            <stop offset="1" stopColor="#2E7D32" />
          </linearGradient>
          <linearGradient id="leafGradient" x1="18" y1="16" x2="30" y2="34" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E8F5E9" />
            <stop offset="1" stopColor="#A5D6A7" />
          </linearGradient>
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
