/**
 * Proactive daily digest endpoint.
 *
 * Invoked by an Apps Script time trigger (NOT a browser session), so it
 * authenticates with a shared bearer secret and reads the single digest user's
 * data via the service-role client. Returns { subject, html } — Apps Script
 * relays that into Gmail. See docs/EMAIL_DIGESTS.md.
 *
 *   GET /api/digest?slot=morning|midday|evening
 *   Authorization: Bearer <DIGEST_SECRET>
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, resolveDigestUserId } from '@/lib/supabase-admin'
import { buildDigest, type DigestSlot } from '@/lib/email-digest'
import type { Meal } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Pro plan; stays under Apps Script's UrlFetch timeout

const VALID_SLOTS: DigestSlot[] = ['morning', 'midday', 'evening']
const HISTORY_DAYS = 90

/* eslint-disable @typescript-eslint/no-explicit-any */
function dbRowToMeal(row: any): Meal {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    items: row.items || [],
    totalCalories: row.total_calories,
    totalProtein: row.total_protein,
    totalFiber: row.total_fiber,
    context: row.context,
    createdAt: row.created_at,
  }
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.DIGEST_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  return token.length > 0 && token === secret
}

export async function GET(request: NextRequest) {
  try {
    if (!authorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const slot = request.nextUrl.searchParams.get('slot') as DigestSlot | null
    if (!slot || !VALID_SLOTS.includes(slot)) {
      return NextResponse.json(
        { error: `Invalid slot — expected one of ${VALID_SLOTS.join(', ')}` },
        { status: 400 },
      )
    }

    const userId = await resolveDigestUserId()
    const admin = getSupabaseAdmin()

    const since = new Date()
    since.setDate(since.getDate() - HISTORY_DAYS)
    const sinceStr = since.toISOString().slice(0, 10)

    const [mealsRes, settingsRes, memoryRes] = await Promise.all([
      admin
        .from('meals')
        .select('*')
        .eq('user_id', userId)
        .gte('date', sinceStr)
        .order('date', { ascending: false }),
      admin.from('settings').select('weight').eq('user_id', userId).maybeSingle(),
      admin
        .from('coach_memory')
        .select('fact')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
    ])

    if (mealsRes.error) throw mealsRes.error

    const meals = (mealsRes.data || []).map(dbRowToMeal)
    const weightLbs = Number(settingsRes.data?.weight) || 0
    const memories = (memoryRes.data || [])
      .map((r: any) => (typeof r.fact === 'string' ? r.fact : ''))
      .filter(Boolean)

    const { subject, html } = await buildDigest(slot, { meals, weightLbs, memories })

    return NextResponse.json({ subject, html })
  } catch (error) {
    console.error('Digest error:', error)
    return NextResponse.json({ error: 'Failed to build digest' }, { status: 500 })
  }
}
