import { NextRequest, NextResponse } from 'next/server'
import { getOpenAI, PARSE_MEAL_PROMPT } from '@/lib/openai'
import { FoodItem, FoodCategory } from '@/types'
import { randomUUID } from 'crypto'

const CATEGORY_ENUM: FoodCategory[] = [
  'vegetable',
  'leafy_crucifer',
  'fruit',
  'legume_soy',
  'whole_grain',
  'nut_seed',
  'healthy_fat',
  'fish_omega3',
  'red_meat',
  'processed_meat',
  'sugary_drink',
  'ultra_processed',
]

/**
 * Lean response schema — every byte the model has to emit slows down the parse.
 * Past versions required all 12 categories as nullable keys on a `servings`
 * object (~60 tokens per item even for "vegetable" because of all the
 * "category":null entries). This version uses a sparse array so the model
 * only emits servings entries that actually apply.
 *
 * processingLevel was also dropped — UPF is signalled via the
 * "ultra_processed" category instead.
 */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          fiber: { type: 'number' },
          quantity: { type: ['string', 'null'] },
          categories: {
            type: 'array',
            items: { type: 'string', enum: CATEGORY_ENUM },
          },
          servings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string', enum: CATEGORY_ENUM },
                amount: { type: 'number' },
              },
              required: ['category', 'amount'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'calories', 'protein', 'fiber', 'quantity', 'categories', 'servings'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

interface RawServingEntry {
  category: string
  amount: number
}

interface RawParsedItem {
  name?: string
  calories?: number
  protein?: number
  fiber?: number
  quantity?: string | null
  categories?: string[]
  servings?: RawServingEntry[]
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid text field' },
        { status: 400 }
      )
    }

    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'user',
          content: PARSE_MEAL_PROMPT + text,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'parsed_meal',
          schema: RESPONSE_SCHEMA,
          strict: true,
        },
      },
    })

    const content = completion.choices[0]?.message?.content || '{"items":[]}'

    let parsed: { items: RawParsedItem[] }
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('Failed to parse OpenAI response:', content)
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      )
    }

    const items: FoodItem[] = (parsed.items || []).map((item) => {
      // Convert sparse servings array to the Partial<Record<FoodCategory, number>>
      // shape the rest of the app expects.
      const servings: Partial<Record<FoodCategory, number>> = {}
      const servingsArray = Array.isArray(item.servings) ? item.servings : []
      for (const s of servingsArray) {
        if (
          s &&
          typeof s.category === 'string' &&
          CATEGORY_ENUM.includes(s.category as FoodCategory) &&
          typeof s.amount === 'number' &&
          s.amount > 0
        ) {
          servings[s.category as FoodCategory] = s.amount
        }
      }

      const categories = Array.isArray(item.categories)
        ? item.categories.filter((c): c is FoodCategory =>
            CATEGORY_ENUM.includes(c as FoodCategory),
          )
        : []

      // Derive processingLevel for legacy clients: anything tagged
      // ultra_processed in categories also gets the field set, so older
      // CategoryChips fallback logic continues to work.
      const processingLevel = categories.includes('ultra_processed')
        ? 'ultra_processed'
        : undefined

      return {
        id: randomUUID(),
        name: item.name || 'Unknown food',
        calories: Math.round(item.calories || 0),
        protein: Math.round(item.protein || 0),
        fiber: Math.round(item.fiber || 0),
        quantity: item.quantity || undefined,
        categories,
        servings: Object.keys(servings).length > 0 ? servings : undefined,
        processingLevel,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('Parse meal error:', error)
    return NextResponse.json(
      { error: 'Failed to parse meal' },
      { status: 500 }
    )
  }
}
