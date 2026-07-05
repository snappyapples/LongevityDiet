/**
 * DEV-ONLY digest preview. Renders all three slots from a synthetic week of
 * meals with a canned "new ideas" generator — no auth, no Supabase, no OpenAI.
 * Returns 404 in production. Open http://localhost:3000/api/digest/preview
 */
import { NextResponse } from 'next/server'
import { format, subDays } from 'date-fns'
import type { FoodCategory, FoodItem, Meal, MealType } from '@/types'
import { buildDigest, type DigestSlot, type NewIdeasFn } from '@/lib/email-digest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let _id = 0
function item(
  name: string,
  calories: number,
  protein: number,
  fiber: number,
  categories: FoodCategory[],
  servings: Partial<Record<FoodCategory, number>>,
  processingLevel?: FoodItem['processingLevel'],
): FoodItem {
  return { id: `i${_id++}`, name, calories, protein, fiber, categories, servings, processingLevel }
}

interface Tmpl {
  type: MealType
  daysAgo: number[]
  items: FoodItem[]
}

function buildFixtureMeals(today: Date): Meal[] {
  const templates: Tmpl[] = [
    // breakfast — favorite (5x) + recent (1x)
    {
      type: 'breakfast',
      daysAgo: [1, 4, 8, 15, 22],
      items: [
        item('Rolled oats', 150, 5, 4, ['whole_grain'], { whole_grain: 1 }),
        item('Blueberries', 40, 0.5, 2, ['fruit'], { fruit: 0.5 }),
        item('Walnuts', 100, 2.5, 1, ['nut_seed', 'healthy_fat'], { nut_seed: 0.5, healthy_fat: 0.5 }),
      ],
    },
    {
      type: 'breakfast',
      daysAgo: [3],
      items: [
        item('Greek yogurt', 120, 17, 0, [], {}),
        item('Granola', 140, 3, 2, ['ultra_processed'], { ultra_processed: 1 }, 'ultra_processed'),
      ],
    },
    // lunch — favorite (4x) + recent (1x)
    {
      type: 'lunch',
      daysAgo: [2, 6, 9, 20],
      items: [
        item('Cooked lentils', 115, 9, 8, ['legume_soy'], { legume_soy: 1 }),
        item('Baby spinach', 20, 2, 2, ['vegetable', 'leafy_crucifer'], { vegetable: 2, leafy_crucifer: 2 }),
        item('Olive oil', 120, 0, 0, ['healthy_fat'], { healthy_fat: 1 }),
      ],
    },
    {
      type: 'lunch',
      daysAgo: [5],
      items: [
        item('Brown rice', 110, 2.5, 1.8, ['whole_grain'], { whole_grain: 1 }),
        item('Ahi tuna', 90, 20, 0, [], {}),
        item('Edamame', 90, 8, 4, ['legume_soy'], { legume_soy: 1 }),
        item('Cucumber', 8, 0, 0.5, ['vegetable'], { vegetable: 0.5 }),
      ],
    },
    // dinner — favorite (4x) + recent (1x)
    {
      type: 'dinner',
      daysAgo: [1, 7, 12, 18],
      items: [
        item('Grilled salmon', 230, 25, 0, ['fish_omega3', 'healthy_fat'], { fish_omega3: 1, healthy_fat: 1 }),
        item('Broccoli', 55, 4, 5, ['vegetable', 'leafy_crucifer'], { vegetable: 2, leafy_crucifer: 2 }),
        item('Quinoa', 120, 4, 3, ['whole_grain'], { whole_grain: 1 }),
      ],
    },
    {
      type: 'dinner',
      daysAgo: [4],
      items: [
        item('Black beans', 110, 7, 7, ['legume_soy'], { legume_soy: 1 }),
        item('Grilled chicken', 140, 26, 0, [], {}),
        item('White rice', 130, 2.5, 0.5, [], {}),
        item('Salsa', 20, 1, 1, ['vegetable'], { vegetable: 0.5 }),
      ],
    },
    // snacks — favorite (3x) + recent (1x)
    {
      type: 'snack',
      daysAgo: [2, 5, 9],
      items: [item('Almonds', 160, 6, 3.5, ['nut_seed', 'healthy_fat'], { nut_seed: 1, healthy_fat: 0.5 })],
    },
    {
      type: 'snack',
      daysAgo: [6],
      items: [
        item('Apple', 95, 0.5, 4, ['fruit'], { fruit: 1 }),
        item('Peanut butter', 190, 7, 2, ['nut_seed'], { nut_seed: 1 }),
      ],
    },
  ]

  const meals: Meal[] = []
  let mid = 0
  for (const t of templates) {
    for (const d of t.daysAgo) {
      const totalCalories = t.items.reduce((s, i) => s + i.calories, 0)
      const totalProtein = t.items.reduce((s, i) => s + i.protein, 0)
      const totalFiber = t.items.reduce((s, i) => s + i.fiber, 0)
      meals.push({
        id: `m${mid++}`,
        type: t.type,
        date: format(subDays(today, d), 'yyyy-MM-dd'),
        items: t.items,
        totalCalories,
        totalProtein,
        totalFiber,
        createdAt: new Date().toISOString(),
      })
    }
  }
  return meals
}

// Canned novelty generator so the preview is offline + deterministic.
const cannedNewIdeas: NewIdeasFn = async (req) => {
  const byType: Record<MealType, { label: string; why: string }[]> = {
    breakfast: [
      { label: 'Tofu veggie scramble', why: 'Adds legumes/soy and a serving of vegetables you’re light on.' },
      { label: 'Steel-cut oats with kiwi & chia', why: 'Whole grains plus fruit and seeds in one bowl.' },
    ],
    lunch: [
      { label: 'Three-bean & farro salad', why: 'Doubles down on legumes and whole grains to close both gaps.' },
      { label: 'Sardine & arugula whole-grain toast', why: 'Omega-3 fish plus greens — and ~22g protein.' },
    ],
    dinner: [
      { label: 'Miso-glazed mackerel with bok choy', why: 'A second fish serving this week plus crucifers.' },
      { label: 'Chickpea & kale curry', why: 'Legumes and leafy greens, no red meat.' },
    ],
    snack: [
      { label: 'Roasted chickpeas', why: 'Crunchy legume hit between meals.' },
      { label: 'Pumpkin seeds & an orange', why: 'Seeds plus a fruit serving.' },
    ],
    indulgence: [],
  }
  const primaryNew = (byType[req.primaryType] || []).slice(0, req.primaryLimit)
  const snackNew = req.snackType ? (byType[req.snackType] || []).slice(0, req.snackLimit) : []
  return { primaryNew, snackNew }
}

function escAttr(html: string): string {
  return html.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }

  const today = new Date()
  const meals = buildFixtureMeals(today)
  const data = { meals, weightLbs: 180, memories: ['Keeps Greek yogurt and eggs stocked', 'No more than 20 min of cooking on weekdays'] }

  const slots: DigestSlot[] = ['morning', 'midday', 'evening']
  const frames: string[] = []
  for (const slot of slots) {
    const { subject, html } = await buildDigest(slot, data, {
      today,
      generateNewIdeas: cannedNewIdeas,
    })
    frames.push(`
      <div style="margin:0 0 8px;font:600 13px -apple-system,sans-serif;color:#374151;">
        <span style="text-transform:uppercase;letter-spacing:.06em;color:#6b7280;">${slot}</span>
        &nbsp;·&nbsp; Subject: <em>${subject.replace(/</g, '&lt;')}</em>
      </div>
      <iframe srcdoc="${escAttr(html)}" style="width:640px;height:1500px;border:1px solid #d1d5db;border-radius:8px;background:#fff;"></iframe>`)
  }

  const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Digest preview</title></head>
  <body style="margin:0;padding:28px;background:#e5e7eb;font-family:-apple-system,sans-serif;">
    <h1 style="font-size:18px;color:#111827;">Digest preview <span style="font-weight:400;color:#6b7280;">(synthetic data · canned “new” ideas)</span></h1>
    <div style="display:flex;flex-direction:column;gap:36px;align-items:flex-start;">${frames.join('')}</div>
  </body></html>`

  return new NextResponse(page, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
