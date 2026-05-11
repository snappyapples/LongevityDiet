'use client'

import type { FoodItem } from '@/types'

/**
 * Client-side localStorage cache for parsed meal items, keyed by normalized
 * input text. The OpenAI call costs 3-5s and dominates the perceived latency
 * of "Log it" / "Evaluate"; for repeated descriptions ("oatmeal with berries",
 * "Costco salad") we can return instantly from the previous parse.
 *
 * Bump CACHE_KEY when the parse prompt changes meaningfully — old cached
 * classifications become stale.
 */
const CACHE_KEY = 'fitnesslove.parseCache.v3'  // bump to invalidate after prompt changes
const TTL_MS = 30 * 24 * 60 * 60 * 1000        // 30 days
const MAX_ENTRIES = 100

interface CacheEntry {
  items: Omit<FoodItem, 'id'>[]
  cachedAt: number
}

type CacheMap = Record<string, CacheEntry>

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

function readCache(): CacheMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as CacheMap) : {}
  } catch {
    return {}
  }
}

function writeCache(cache: CacheMap) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Quota exceeded or other; drop silently
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cli_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function rehydrate(items: Omit<FoodItem, 'id'>[]): FoodItem[] {
  return items.map((item) => ({ ...item, id: generateId() }))
}

/**
 * Look up cached parse result. Returns rehydrated FoodItems (with fresh IDs)
 * or null if no fresh cache entry exists.
 */
export function getCachedParse(text: string): FoodItem[] | null {
  const key = normalize(text)
  if (!key) return null
  const cache = readCache()
  const entry = cache[key]
  if (!entry) return null
  if (Date.now() - entry.cachedAt > TTL_MS) {
    delete cache[key]
    writeCache(cache)
    return null
  }
  return rehydrate(entry.items)
}

/**
 * Store the parsed items keyed by normalized input. Trims to MAX_ENTRIES
 * (keep newest by cachedAt). Strips IDs since they're regenerated on read.
 */
export function setCachedParse(text: string, items: FoodItem[]) {
  const key = normalize(text)
  if (!key || items.length === 0) return
  const cache = readCache()
  cache[key] = {
    items: items.map(({ id: _id, ...rest }) => rest),
    cachedAt: Date.now(),
  }
  const entries = Object.entries(cache)
  if (entries.length > MAX_ENTRIES) {
    entries.sort((a, b) => b[1].cachedAt - a[1].cachedAt)
    const trimmed: CacheMap = {}
    for (const [k, v] of entries.slice(0, MAX_ENTRIES)) {
      trimmed[k] = v
    }
    writeCache(trimmed)
  } else {
    writeCache(cache)
  }
}

/**
 * Wrap fetch('/api/parse-meal') with a localStorage cache. Returns parsed
 * items (with fresh IDs) — instantly on a cache hit, otherwise after the
 * usual server round-trip.
 */
export async function parseWithCache(text: string): Promise<FoodItem[]> {
  const cached = getCachedParse(text)
  if (cached) return cached

  const res = await fetch('/api/parse-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('Failed to parse meal')
  const data = await res.json()
  const items: FoodItem[] = Array.isArray(data?.items) ? data.items : []
  if (items.length > 0) setCachedParse(text, items)
  return items
}
