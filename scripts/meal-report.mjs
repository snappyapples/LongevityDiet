/**
 * Pulls last 100 meals with items and prints an analysis report:
 * - Date range, totals
 * - Food frequency (how often each item appears)
 * - Macros averages
 * - Meal-type distribution
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: 'C:/Users/justi/Documents/aiPersonal/FitnessLove/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const { data: meals, error } = await supabase
  .from('meals')
  .select('id, date, type, items, total_calories, total_protein, total_fiber, context, created_at')
  .order('date', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(100)

if (error) {
  console.error('Error:', error)
  process.exit(1)
}

console.log(`\n=== LAST ${meals.length} MEALS REPORT ===\n`)

if (meals.length === 0) {
  console.log('No meals found.')
  process.exit(0)
}

const newest = meals[0].date
const oldest = meals[meals.length - 1].date
console.log(`Date range: ${oldest} → ${newest}`)

// Meal type distribution
const byType = {}
for (const m of meals) byType[m.type] = (byType[m.type] || 0) + 1
console.log(`\nMeal type distribution:`)
for (const [t, c] of Object.entries(byType).sort((a,b) => b[1]-a[1])) {
  console.log(`  ${t.padEnd(12)} ${c}`)
}

// Macro averages (per meal)
const avg = (arr) => arr.length ? arr.reduce((a,b) => a+b, 0) / arr.length : 0
const cals = meals.map(m => Number(m.total_calories) || 0)
const prot = meals.map(m => Number(m.total_protein) || 0)
const fib  = meals.map(m => Number(m.total_fiber)   || 0)
console.log(`\nPer-meal averages:`)
console.log(`  Calories: ${avg(cals).toFixed(0)}`)
console.log(`  Protein:  ${avg(prot).toFixed(1)}g`)
console.log(`  Fiber:    ${avg(fib).toFixed(1)}g`)

// Daily totals (for days that appear in this window)
const byDay = {}
for (const m of meals) {
  if (!byDay[m.date]) byDay[m.date] = { cal: 0, prot: 0, fib: 0, count: 0 }
  byDay[m.date].cal  += Number(m.total_calories) || 0
  byDay[m.date].prot += Number(m.total_protein)  || 0
  byDay[m.date].fib  += Number(m.total_fiber)    || 0
  byDay[m.date].count++
}
const dayKeys = Object.keys(byDay)
const dayCals = dayKeys.map(d => byDay[d].cal)
const dayProt = dayKeys.map(d => byDay[d].prot)
const dayFib  = dayKeys.map(d => byDay[d].fib)
console.log(`\nDaily averages (${dayKeys.length} days):`)
console.log(`  Calories: ${avg(dayCals).toFixed(0)}`)
console.log(`  Protein:  ${avg(dayProt).toFixed(1)}g`)
console.log(`  Fiber:    ${avg(dayFib).toFixed(1)}g`)

// Food frequency — normalize item names (lowercase, trim)
const foodCounts = {}
const foodCalSum = {}
const foodProtSum = {}
const foodFibSum = {}
let totalItems = 0
for (const m of meals) {
  const items = Array.isArray(m.items) ? m.items : []
  for (const it of items) {
    totalItems++
    const name = String(it.name || '').trim().toLowerCase()
    if (!name) continue
    foodCounts[name] = (foodCounts[name] || 0) + 1
    foodCalSum[name]  = (foodCalSum[name]  || 0) + (Number(it.calories) || 0)
    foodProtSum[name] = (foodProtSum[name] || 0) + (Number(it.protein)  || 0)
    foodFibSum[name]  = (foodFibSum[name]  || 0) + (Number(it.fiber)    || 0)
  }
}
console.log(`\nTotal food items logged: ${totalItems}`)
console.log(`Unique foods: ${Object.keys(foodCounts).length}`)

const ranked = Object.entries(foodCounts).sort((a,b) => b[1]-a[1])
console.log(`\nTop 40 most-eaten foods:`)
console.log(`  ${'food'.padEnd(40)} ${'count'.padStart(5)}  ${'avg cal'.padStart(7)}  ${'avg prot'.padStart(8)}  ${'avg fib'.padStart(7)}`)
for (const [name, count] of ranked.slice(0, 40)) {
  const c = (foodCalSum[name]  / count).toFixed(0)
  const p = (foodProtSum[name] / count).toFixed(1)
  const f = (foodFibSum[name]  / count).toFixed(1)
  const display = name.length > 40 ? name.slice(0, 37) + '...' : name
  console.log(`  ${display.padEnd(40)} ${String(count).padStart(5)}  ${c.padStart(7)}  ${(p+'g').padStart(8)}  ${(f+'g').padStart(7)}`)
}

// Context: hunger / calm averages
const withCtx = meals.filter(m => m.context)
const hunger = withCtx.map(m => Number(m.context?.hungerLevel)).filter(n => !isNaN(n))
const calm   = withCtx.map(m => Number(m.context?.stressLevel)).filter(n => !isNaN(n))
console.log(`\nContext coverage: ${withCtx.length}/${meals.length} meals`)
if (hunger.length) console.log(`  Avg hunger (1-5): ${avg(hunger).toFixed(2)}`)
if (calm.length)   console.log(`  Avg calm (1-5):   ${avg(calm).toFixed(2)}`)

// Dump full JSON for deeper analysis
import { writeFileSync } from 'fs'
writeFileSync('./scripts/meal-report.json', JSON.stringify(meals, null, 2))
console.log(`\nFull data written to scripts/meal-report.json`)
