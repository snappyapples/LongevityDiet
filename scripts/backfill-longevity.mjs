/**
 * One-time backfill: re-classifies every existing meal's items with
 * longevity categories, servings, and processingLevel.
 *
 * Uses the user's email/password via Supabase Auth (so RLS authorizes reads/writes).
 *
 * Usage:
 *   APP_EMAIL="you@example.com" APP_PASSWORD="yourpass" node scripts/backfill-longevity.mjs
 *
 * Optional:
 *   FORCE_TERMS="chicken,turkey,duck,poultry,meatball"
 *     Re-process any meal whose item names include any of these substrings,
 *     even if already classified. Useful when you tighten the prompt and
 *     want to fix previously-misclassified items (e.g. poultry mislabeled
 *     as red_meat). Case-insensitive. Comma-separated.
 *
 * Safe to re-run: only touches meals whose items lack categories OR match
 * FORCE_TERMS. Preserves existing calories/protein/fiber — only updates
 * classification fields.
 */

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Resolve .env.local relative to this script (scripts/ → project root) so the
// path survives a folder rename. Don't hardcode an absolute project path here.
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const EMAIL = process.env.APP_EMAIL
const PASSWORD = process.env.APP_PASSWORD
const FORCE_TERMS = (process.env.FORCE_TERMS || '')
  .split(',')
  .map((t) => t.trim().toLowerCase())
  .filter(Boolean)

if (!EMAIL || !PASSWORD) {
  console.error('Set APP_EMAIL and APP_PASSWORD env vars.')
  console.error('Example: APP_EMAIL="you@example.com" APP_PASSWORD="***" node scripts/backfill-longevity.mjs')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const CLASSIFY_PROMPT = `You classify food items for a longevity-score app (adapted AHEI-2010).

For EACH input item, return:
- categories: array of applicable categories (empty array if none apply)
- servings: object mapping each applicable category to AHEI-style serving count (number)
- processingLevel: one of "whole", "minimal", "processed", "ultra_processed"

CATEGORIES:
- "vegetable": non-starchy vegetables. Potatoes are NOT a vegetable.
- "leafy_crucifer": leafy greens or crucifers. Also include "vegetable" when this applies.
- "fruit": whole fruit. Juice is NOT fruit — classify as "sugary_drink".
- "legume_soy": beans, lentils, chickpeas, peas, tofu, tempeh, edamame.
- "whole_grain": oats, brown rice, quinoa, whole wheat, barley, farro. Refined grains do NOT qualify.
- "nut_seed": nuts, seeds, nut butters.
- "healthy_fat": EVOO, avocado, olives, fatty fish, nuts/seeds. Butter/coconut oil do NOT qualify.
- "fish_omega3": salmon, sardines, trout, herring, mackerel, anchovies. Lean white fish does NOT qualify.
- "red_meat": unprocessed BEEF, PORK, LAMB, BISON, VENISON, GOAT only. POULTRY IS NOT RED MEAT — chicken, turkey, duck, goose belong to NO positive category (they are neutral). Meatballs/meatloaf default to red_meat UNLESS the name says poultry ("turkey meatballs") in which case they are NOT red_meat.
- "processed_meat": bacon, sausage, hot dog, deli meat, salami, pepperoni, ham, jerky. Chicken sausage and turkey bacon still count.
- "sugary_drink": soda, sweetened drinks, fruit juice, sports/energy drinks.
- "ultra_processed": NOVA group 4 — chips, candy, cookies, snack bars, fast food, frozen ready meals, sweetened cereal, processed cheese. IMPORTANT: restaurant/takeout dishes that are BREADED AND FRIED (orange chicken, sesame chicken, general tso's, chicken nuggets, chicken tenders, popcorn chicken, tempura, fried fish sandwich) ARE ultra_processed. Dishes with SUGARY sauces (orange chicken, sweet & sour, teriyaki glaze, BBQ pulled-pork) ARE ultra_processed.

SERVING SIZES:
- vegetable/leafy_crucifer: 1/2 cup cooked OR 1 cup raw
- fruit: 1 medium piece OR 1/2 cup
- legume_soy: 1/2 cup cooked OR 4 oz tofu
- whole_grain: 1/2 cup cooked OR 1 slice whole-grain bread
- nut_seed: 1 oz (~1/4 cup nuts or 2 tbsp nut butter)
- healthy_fat: 1 tbsp oil OR 1/2 avocado OR 1 oz olives
- fish_omega3: 3.5 oz cooked
- red_meat/processed_meat: 3 oz
- sugary_drink: 8 oz

Use the item name AND calorie count to estimate portion size. If the item is generic (e.g. "salad"), assume a reasonable default portion matching the calories.

Return ONLY a JSON array of the same length, in the same order:
[
  { "categories": [...], "servings": {...}, "processingLevel": "..." }
]

Input items:
`

async function classifyItems(items) {
  const input = items.map((it, i) => `${i + 1}. ${it.name} (${it.calories} cal${it.quantity ? `, ${it.quantity}` : ''})`).join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [{ role: 'user', content: CLASSIFY_PROMPT + input }],
  })

  const content = completion.choices[0]?.message?.content || '[]'
  const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim()
  return JSON.parse(jsonStr)
}

async function main() {
  console.log('Signing in as', EMAIL)
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (authErr) {
    console.error('Auth failed:', authErr.message)
    process.exit(1)
  }
  const userId = authData.user.id
  console.log('Authenticated as user', userId)

  console.log('\nFetching meals...')
  const { data: meals, error } = await supabase
    .from('meals')
    .select('id, date, type, items')
    .eq('user_id', userId)
    .order('date', { ascending: false })

  if (error) {
    console.error('Query failed:', error)
    process.exit(1)
  }
  console.log(`Found ${meals.length} total meals.`)

  // Re-process meals where: any item lacks categories, OR (FORCE_TERMS set) any
  // item name matches one of the terms.
  const toProcess = meals.filter((m) => {
    const items = Array.isArray(m.items) ? m.items : []
    const lacksCategories = items.some((it) => !it.categories)
    if (lacksCategories) return true
    if (FORCE_TERMS.length > 0) {
      const hit = items.some((it) => {
        const name = String(it.name || '').toLowerCase()
        return FORCE_TERMS.some((term) => name.includes(term))
      })
      if (hit) return true
    }
    return false
  })
  if (FORCE_TERMS.length > 0) {
    console.log(`FORCE_TERMS active: [${FORCE_TERMS.join(', ')}]`)
  }
  console.log(`${toProcess.length} meals need classification.\n`)

  let updated = 0
  let failed = 0

  for (const meal of toProcess) {
    const items = Array.isArray(meal.items) ? meal.items : []
    if (items.length === 0) continue

    process.stdout.write(`  ${meal.date} ${meal.type.padEnd(10)} (${items.length} items)... `)
    try {
      const classifications = await classifyItems(items)
      if (!Array.isArray(classifications) || classifications.length !== items.length) {
        console.log('SKIP (mismatched response length)')
        failed++
        continue
      }

      const newItems = items.map((it, i) => {
        const c = classifications[i] || {}
        return {
          ...it,
          categories: Array.isArray(c.categories) ? c.categories : [],
          servings: c.servings && typeof c.servings === 'object' ? c.servings : {},
          processingLevel: c.processingLevel || 'minimal',
        }
      })

      const { error: updErr } = await supabase
        .from('meals')
        .update({ items: newItems })
        .eq('id', meal.id)
        .eq('user_id', userId)

      if (updErr) {
        console.log(`FAIL: ${updErr.message}`)
        failed++
      } else {
        console.log('ok')
        updated++
      }
    } catch (err) {
      console.log(`FAIL: ${err.message}`)
      failed++
    }

    // Small delay to be nice to the API
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log(`\n=== Done ===`)
  console.log(`Updated: ${updated}`)
  console.log(`Failed:  ${failed}`)
  console.log(`Skipped (already classified): ${meals.length - toProcess.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
