/**
 * Meal history → candidate buckets for the proactive email digests.
 *
 * Your past meals already carry `categories` / `servings` / `protein` per item,
 * so we can pick "old favorites" and "recent cravings" deterministically — and
 * rank them by how much they'd actually move your CURRENT rolling-window gaps —
 * without asking the LLM to guess. The AI is reserved for the "brand new" bucket
 * (see email-digest.ts). See docs/EMAIL_DIGESTS.md.
 */
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { FoodItem, Meal, MealType } from '@/types'
import { scoreWindow } from './longevity-score'

// Lookback for collecting candidates, and the recency window for "cravings".
const FAVORITE_LOOKBACK_DAYS = 90
const RECENT_WINDOW_DAYS = 21
// A signature logged this many times (within the lookback) is a "go-to".
const MIN_FAVORITE_COUNT = 3

export interface MealCandidate {
  signature: string // normalized item-name key (identity of a "dish")
  label: string // display, e.g. "Oatmeal · blueberries · walnuts"
  items: FoodItem[] // representative item set (from the most recent occurrence)
  count: number // times logged within the lookback window
  lastLoggedDate: string // yyyy-MM-dd of the most recent occurrence
  mealType: MealType
}

export interface RankedCandidate extends MealCandidate {
  projectedGain: number // longevity points this meal would add to the current window
  proteinGain: number // grams of protein it contributes
}

/** Lowercase + strip quantities/punctuation so "Blueberries (1/2 cup)" === "blueberries". */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // drop parenthetical portions
    .replace(/[^a-z\s]/g, ' ') // drop digits/units/punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

/** Identity of a meal = its sorted, de-duped set of normalized item names. */
function mealSignature(items: FoodItem[]): string {
  const names = Array.from(
    new Set(items.map((i) => normalizeName(i.name)).filter(Boolean)),
  ).sort()
  return names.join('|')
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Human label from the representative item set — first few names, " · " joined. */
function prettyLabel(items: FoodItem[]): string {
  const names = items.map((i) => i.name.trim()).filter(Boolean)
  const shown = names.slice(0, 4)
  const label = shown.map(titleCase).join(' · ')
  return names.length > shown.length ? `${label} · …` : label
}

/**
 * Group a user's historical meals of one type into unique candidates, counting
 * how often each "dish" recurs and tracking the most recent occurrence (whose
 * items become the representative set, since portions/parsing improve over time).
 */
export function collectCandidates(
  meals: Meal[],
  type: MealType,
  today: Date = new Date(),
): MealCandidate[] {
  const bySig = new Map<
    string,
    { count: number; lastDate: string; items: FoodItem[] }
  >()

  for (const meal of meals) {
    if (meal.type !== type) continue
    const items = meal.items || []
    if (items.length === 0) continue
    const ageDays = differenceInCalendarDays(today, parseISO(meal.date))
    if (ageDays < 0 || ageDays > FAVORITE_LOOKBACK_DAYS) continue

    const sig = mealSignature(items)
    if (!sig) continue

    const existing = bySig.get(sig)
    if (!existing) {
      bySig.set(sig, { count: 1, lastDate: meal.date, items })
    } else {
      existing.count += 1
      if (meal.date > existing.lastDate) {
        existing.lastDate = meal.date
        existing.items = items // keep the freshest representative
      }
    }
  }

  const candidates: MealCandidate[] = []
  for (const [signature, v] of bySig) {
    candidates.push({
      signature,
      label: prettyLabel(v.items),
      items: v.items,
      count: v.count,
      lastLoggedDate: v.lastDate,
      mealType: type,
    })
  }
  return candidates
}

/** Consistent go-tos: logged at least MIN_FAVORITE_COUNT times in the lookback. */
export function selectFavorites(candidates: MealCandidate[]): MealCandidate[] {
  return candidates.filter((c) => c.count >= MIN_FAVORITE_COUNT)
}

/**
 * Recent cravings: tried lately (within RECENT_WINDOW_DAYS) but not yet a go-to
 * (fewer than MIN_FAVORITE_COUNT logs) — newer experiments worth a rerun.
 */
export function selectRecent(
  candidates: MealCandidate[],
  today: Date = new Date(),
): MealCandidate[] {
  return candidates.filter((c) => {
    if (c.count >= MIN_FAVORITE_COUNT) return false
    const ageDays = differenceInCalendarDays(today, parseISO(c.lastLoggedDate))
    return ageDays >= 0 && ageDays <= RECENT_WINDOW_DAYS
  })
}

/** Sum of the 10 component points (finer than the clamped 0–100 total). */
function fineTotal(items: FoodItem[]): number {
  const s = scoreWindow(items, 7)
  const c = s.components
  return (
    c.vegetables.points +
    c.fruit.points +
    c.legumes.points +
    c.wholeGrains.points +
    c.nutsSeeds.points +
    c.healthyFat.points +
    c.fish.points +
    c.sugaryDrinks.points +
    c.redProcessedMeat.points +
    c.ultraProcessed.points
  )
}

/**
 * Marginal value of a candidate meal: re-score the current 7-day window with the
 * candidate's items added, and report the longevity-point and protein gain.
 * Density normalization means this naturally accounts for the extra calories the
 * meal brings — a meal is ranked by what it's worth GIVEN where you already are.
 */
export function projectMealImpact(
  windowItems: FoodItem[],
  candidateItems: FoodItem[],
): { totalGain: number; proteinGain: number } {
  const base = fineTotal(windowItems)
  const withMeal = fineTotal([...windowItems, ...candidateItems])
  const proteinGain = candidateItems.reduce((sum, i) => sum + (Number(i.protein) || 0), 0)
  return {
    totalGain: Math.round((withMeal - base) * 10) / 10,
    proteinGain: Math.round(proteinGain),
  }
}

/**
 * Rank candidates by projected gap-fit against the current window. Sorted by
 * longevity-point gain desc, protein gain as the tiebreak. Returns the top `limit`.
 */
export function rankByGapFit(
  candidates: MealCandidate[],
  windowItems: FoodItem[],
  limit: number,
): RankedCandidate[] {
  const ranked: RankedCandidate[] = candidates.map((c) => {
    const impact = projectMealImpact(windowItems, c.items)
    return { ...c, projectedGain: impact.totalGain, proteinGain: impact.proteinGain }
  })
  ranked.sort((a, b) => {
    const g = b.projectedGain - a.projectedGain
    if (Math.abs(g) > 0.01) return g
    const p = b.proteinGain - a.proteinGain
    if (p !== 0) return p
    return b.count - a.count // finally prefer the more-established meal
  })
  return ranked.slice(0, limit)
}
