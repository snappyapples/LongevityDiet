/**
 * Read-only inspection of the live coach context for the most recently active
 * user. Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) to read meals + settings,
 * then runs the SAME math as src/lib/longevity-score.ts so the output matches
 * exactly what the deployed app's "What to eat next" list is rendering.
 *
 * USAGE (from project root, NOT the worktree):
 *   node scripts/inspect-coach-data.mjs
 *
 * Loads .env.local from this directory's parent (the project root).
 * Required env vars:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import { format, subDays } from 'date-fns'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Try the worktree's own .env.local first, then the main project root
// (.claude/worktrees/<branch>/scripts/.. then .claude/worktrees/<branch>/../../..)
import fs from 'fs'
const candidates = [
  path.resolve(__dirname, '..', '.env.local'),                     // ./.env.local (sibling of scripts)
  path.resolve(__dirname, '..', '..', '..', '..', '.env.local'),   // main project root from worktree
]
const envPath = candidates.find((p) => fs.existsSync(p))
if (!envPath) {
  console.error('No .env.local found. Tried:', candidates)
  process.exit(1)
}
dotenv.config({ path: envPath })
console.error(`(loaded env from ${envPath})`)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  console.error('  Looked in:', envPath)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// --- Inlined scoring constants (match src/lib/longevity-score.ts) ---

const TARGETS_PER_1000_KCAL = {
  vegetable: 2.5,
  fruit: 1.0,
  legume_soy: 0.5,
  whole_grain: 1.5,
  nut_seed: 0.5,
  healthy_fat: 1.0,
}
const SUGARY_DRINKS_ZERO_SCORE_AT_PER_DAY = 2
const RED_MEAT_ZERO_SCORE_AT_PER_DAY = 1.5
const UPF_FULL_SCORE_AT_PCT = 10
const UPF_ZERO_SCORE_AT_PCT = 50
const FISH_TARGET_PER_WEEK = 2

const POINTS = {
  vegetables: 15,
  fruit: 10,
  legumes: 10,
  wholeGrains: 10,
  nutsSeeds: 5,
  healthyFat: 10,
  fish: 10,
  sugaryDrinks: 10,
  redProcessedMeat: 10,
  ultraProcessed: 10,
}

const COMPONENT_META = [
  { id: 'vegetables', label: 'Vegetables', kind: 'add' },
  { id: 'fruit', label: 'Fruit', kind: 'add' },
  { id: 'legumes', label: 'Legumes / Soy', kind: 'add' },
  { id: 'wholeGrains', label: 'Whole grains', kind: 'add' },
  { id: 'nutsSeeds', label: 'Nuts / Seeds', kind: 'add' },
  { id: 'healthyFat', label: 'Healthy fat', kind: 'add' },
  { id: 'fish', label: 'Fish', kind: 'add' },
  { id: 'sugaryDrinks', label: 'Sugary drinks', kind: 'avoid' },
  { id: 'redProcessedMeat', label: 'Red / processed meat', kind: 'avoid' },
  { id: 'ultraProcessed', label: 'Ultra-processed', kind: 'avoid' },
]

function clamp01(n) {
  if (!isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function aggregateItems(items) {
  const servingsByCat = {
    vegetable: 0, leafy_crucifer: 0, fruit: 0, legume_soy: 0, whole_grain: 0,
    nut_seed: 0, healthy_fat: 0, fish_omega3: 0, red_meat: 0, processed_meat: 0,
    sugary_drink: 0, ultra_processed: 0,
  }
  let totalKcal = 0
  let upfKcal = 0
  for (const item of items) {
    const kcal = Number(item.calories) || 0
    totalKcal += kcal
    if (item.processingLevel === 'ultra_processed' || (item.categories || []).includes('ultra_processed')) {
      upfKcal += kcal
    }
    for (const cat of Object.keys(servingsByCat)) {
      servingsByCat[cat] += item.servings?.[cat] ?? 0
    }
  }
  return { totalKcal, servingsByCat, upfKcal }
}

function scoreWindow(items, windowDays = 7) {
  const agg = aggregateItems(items)
  const fishServings = agg.servingsByCat.fish_omega3
  const hasData = agg.totalKcal > 0
  const kcal1000 = agg.totalKcal / 1000
  const density = (cat) => (kcal1000 > 0 ? agg.servingsByCat[cat] / kcal1000 : 0)

  const vegDensity = density('vegetable')
  const vegetables = clamp01(vegDensity / TARGETS_PER_1000_KCAL.vegetable) * POINTS.vegetables
  const fruitDensity = density('fruit')
  const fruit = clamp01(fruitDensity / TARGETS_PER_1000_KCAL.fruit) * POINTS.fruit
  const legumeDensity = density('legume_soy')
  const legumes = clamp01(legumeDensity / TARGETS_PER_1000_KCAL.legume_soy) * POINTS.legumes
  const wgDensity = density('whole_grain')
  const wholeGrains = clamp01(wgDensity / TARGETS_PER_1000_KCAL.whole_grain) * POINTS.wholeGrains
  const nsDensity = density('nut_seed')
  const nutsSeeds = clamp01(nsDensity / TARGETS_PER_1000_KCAL.nut_seed) * POINTS.nutsSeeds
  const hfDensity = density('healthy_fat')
  const healthyFat = clamp01(hfDensity / TARGETS_PER_1000_KCAL.healthy_fat) * POINTS.healthyFat

  const fishTarget = FISH_TARGET_PER_WEEK * (windowDays / 7)
  const fish = (fishTarget > 0 ? clamp01(fishServings / fishTarget) : 0) * POINTS.fish

  const sdServings = agg.servingsByCat.sugary_drink
  const sdZeroAt = SUGARY_DRINKS_ZERO_SCORE_AT_PER_DAY * windowDays
  const sugaryDrinks = clamp01(1 - sdServings / sdZeroAt) * POINTS.sugaryDrinks

  const redMeatCombined = agg.servingsByCat.red_meat + 2 * agg.servingsByCat.processed_meat
  const rmZeroAt = RED_MEAT_ZERO_SCORE_AT_PER_DAY * windowDays
  const redProcessedMeat = clamp01(1 - redMeatCombined / rmZeroAt) * POINTS.redProcessedMeat

  const upfPct = agg.totalKcal > 0 ? (agg.upfKcal / agg.totalKcal) * 100 : 0
  const upfFrac = clamp01(
    (UPF_ZERO_SCORE_AT_PCT - upfPct) / (UPF_ZERO_SCORE_AT_PCT - UPF_FULL_SCORE_AT_PCT),
  )
  const ultraProcessed = upfFrac * POINTS.ultraProcessed

  const components = {
    vegetables: { points: vegetables, max: POINTS.vegetables, value: vegDensity },
    fruit: { points: fruit, max: POINTS.fruit, value: fruitDensity },
    legumes: { points: legumes, max: POINTS.legumes, value: legumeDensity },
    wholeGrains: { points: wholeGrains, max: POINTS.wholeGrains, value: wgDensity },
    nutsSeeds: { points: nutsSeeds, max: POINTS.nutsSeeds, value: nsDensity },
    healthyFat: { points: healthyFat, max: POINTS.healthyFat, value: hfDensity },
    fish: { points: fish, max: POINTS.fish, value: fishServings },
    sugaryDrinks: { points: sugaryDrinks, max: POINTS.sugaryDrinks, value: sdServings },
    redProcessedMeat: { points: redProcessedMeat, max: POINTS.redProcessedMeat, value: redMeatCombined },
    ultraProcessed: { points: ultraProcessed, max: POINTS.ultraProcessed, value: upfPct },
  }

  const total = Object.values(components).reduce((s, c) => s + c.points, 0)
  const totalScore = hasData ? Math.max(0, Math.min(100, Math.round(total))) : 0

  return { agg, components, totalScore, hasData }
}

function rankComponents(components) {
  const tips = COMPONENT_META.map((meta) => {
    const comp = components[meta.id]
    return {
      id: meta.id,
      label: meta.label,
      kind: meta.kind,
      current: comp.points,
      max: comp.max,
      gap: comp.max - comp.points,
      value: comp.value,
    }
  })
  tips.sort((a, b) => {
    const d = b.gap - a.gap
    if (Math.abs(d) > 0.01) return d
    return b.max - a.max
  })
  return tips
}

// --- Main ---

async function main() {
  // Find the most recently active user (most recent meal)
  const { data: latestMeal, error: latestErr } = await supabase
    .from('meals')
    .select('user_id, date, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (latestErr || !latestMeal) {
    console.error('Could not find any meals:', latestErr?.message)
    process.exit(1)
  }

  const userId = latestMeal.user_id
  const today = new Date()
  const start = format(subDays(today, 6), 'yyyy-MM-dd') // 7-day rolling window

  const { data: meals, error: mealsErr } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('date', start)
    .order('date', { ascending: false })
    .order('created_at', { ascending: true })

  if (mealsErr) {
    console.error('Failed to fetch meals:', mealsErr.message)
    process.exit(1)
  }

  const allItems = (meals || []).flatMap((m) => m.items || [])

  const { agg, components, totalScore, hasData } = scoreWindow(allItems, 7)
  const tips = rankComponents(components)

  // Header
  console.log('='.repeat(70))
  console.log(`COACH CONTEXT — last 7 days ending ${format(today, 'yyyy-MM-dd')}`)
  console.log('='.repeat(70))
  console.log()
  console.log(`Meals in window:  ${meals?.length ?? 0}`)
  console.log(`Items in window:  ${allItems.length}`)
  console.log(`Total kcal:       ${Math.round(agg.totalKcal)}`)
  console.log(`UPF kcal share:   ${agg.totalKcal > 0 ? Math.round((agg.upfKcal / agg.totalKcal) * 100) : 0}%`)
  console.log(`Rolling score:    ${hasData ? totalScore : '—'} / 100`)
  console.log()

  console.log('SERVINGS BY CATEGORY (totals over the 7-day window):')
  for (const [cat, servings] of Object.entries(agg.servingsByCat)) {
    if (servings > 0) {
      const density = agg.totalKcal > 0 ? (servings / (agg.totalKcal / 1000)).toFixed(2) : '0'
      console.log(`  ${cat.padEnd(18)} ${servings.toFixed(2).padStart(7)} svg   (${density} per 1000 kcal)`)
    }
  }
  console.log()

  console.log('"WHAT TO EAT NEXT" RANKED LIST (matches the app):')
  console.log('-'.repeat(70))
  for (let i = 0; i < tips.length; i++) {
    const t = tips[i]
    const pts = t.current.toFixed(1).padStart(5)
    const max = String(t.max).padStart(2)
    const gap = t.gap.toFixed(1).padStart(5)
    const icon = t.kind === 'add' ? '[+]' : '[−]'
    const dialedIn = t.gap < 0.5 ? '  ✓' : ''
    console.log(`  ${String(i + 1).padStart(2)}. ${icon} ${t.label.padEnd(22)} ${pts}/${max} pts   gap ${gap}${dialedIn}`)
  }
  console.log()

  console.log('SAMPLE OF ITEMS IN WINDOW (most recent 30):')
  const recentItems = []
  for (const m of (meals || [])) {
    for (const item of m.items || []) {
      recentItems.push({ date: m.date, type: m.type, ...item })
      if (recentItems.length >= 30) break
    }
    if (recentItems.length >= 30) break
  }
  for (const it of recentItems) {
    const cats = (it.categories || []).join(',') || '—'
    console.log(`  ${it.date} ${(it.type || '').padEnd(9)} ${(it.name || '').slice(0, 35).padEnd(36)} cal:${String(it.calories ?? 0).padStart(4)}  [${cats}]`)
  }
}

main().catch((e) => {
  console.error('Error:', e)
  process.exit(1)
})
