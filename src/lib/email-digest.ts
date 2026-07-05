/**
 * Email digest orchestrator. Turns a user's meal history + current gaps into a
 * fully-rendered email for one of the three daily slots. See docs/EMAIL_DIGESTS.md.
 *
 *   slot → fetch data → current gaps/protein → per-section buckets
 *        (favorites + recent are deterministic; "new" is one gpt-5-mini call)
 *        → DigestView → email-template → { subject, html }
 *
 * Delivery (Apps Script + Gmail) lives outside this module; here we only produce
 * the subject + HTML body.
 */
import { format, subDays } from 'date-fns'
import type { FoodItem, Meal, MealType } from '@/types'
import { buildLongevityReport, getRankedComponentTips } from './longevity-score'
import { getProteinTarget, getTodayProtein, DEFAULT_PROTEIN_MULTIPLIER } from './protein-target'
import {
  collectCandidates,
  rankByGapFit,
  selectFavorites,
  selectRecent,
  type RankedCandidate,
} from './meal-history'
import { buildCoachContext, type CoachContextGap } from './coach'
import { getOpenAI } from './openai'
import { renderDigestEmail } from './email-template'

export type DigestSlot = 'morning' | 'midday' | 'evening'

export interface NewIdea {
  label: string
  why: string
}

export interface DigestSectionView {
  heading: string
  favorites: RankedCandidate[]
  recent: RankedCandidate[]
  fresh: NewIdea[]
}

export interface DigestGapView {
  label: string
  gapPoints: number
  kind: 'add' | 'avoid'
}

export interface DigestView {
  slot: DigestSlot
  greeting: string
  dateLabel: string
  rollingScore: number
  rollingHasData: boolean
  /** Only show per-meal "+X longevity pts" when the window has real data to rank against. */
  showProjectedGain: boolean
  weeklyDelta: number | null
  topGaps: DigestGapView[]
  proteinCurrent: number
  proteinTarget: number
  sections: DigestSectionView[]
  appUrl: string
}

/** Raw inputs the digest needs — fetched by the API route via the admin client. */
export interface DigestData {
  meals: Meal[]
  weightLbs: number
  memories: string[]
}

interface SectionSpec {
  heading: string
  type: MealType
  limits: { favorites: number; recent: number; fresh: number }
}

interface SlotSpec {
  greeting: string
  subjectStem: string
  sections: SectionSpec[]
}

const SLOTS: Record<DigestSlot, SlotSpec> = {
  morning: {
    greeting: 'Good morning',
    subjectStem: 'Breakfast',
    sections: [
      { heading: 'Breakfast', type: 'breakfast', limits: { favorites: 2, recent: 2, fresh: 2 } },
      { heading: 'Mid-morning snack', type: 'snack', limits: { favorites: 1, recent: 1, fresh: 1 } },
    ],
  },
  midday: {
    greeting: 'Hope the morning went well',
    subjectStem: 'Lunch',
    sections: [
      { heading: 'Lunch', type: 'lunch', limits: { favorites: 2, recent: 2, fresh: 2 } },
      { heading: 'Afternoon snack', type: 'snack', limits: { favorites: 1, recent: 1, fresh: 1 } },
    ],
  },
  evening: {
    greeting: 'Good evening',
    subjectStem: 'Dinner',
    sections: [
      { heading: 'Dinner', type: 'dinner', limits: { favorites: 2, recent: 2, fresh: 2 } },
    ],
  },
}

/** Items logged in the current 7-day rolling window (for marginal-impact ranking). */
function currentWindowItems(meals: Meal[], today: Date): FoodItem[] {
  const start = format(subDays(today, 6), 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')
  const out: FoodItem[] = []
  for (const m of meals) {
    if (m.date >= start && m.date <= todayStr) out.push(...(m.items || []))
  }
  return out
}

const DIGEST_NEW_PROMPT = `You are a longevity nutrition coach generating BRAND-NEW meal ideas for a daily email. The user follows an adapted AHEI-2010 diet-quality score (0-100, rolling 7-day window) plus a daily protein target.

Your job: invent meals the user has NOT logged before that would best close their current gaps.

RULES:
- Anchor every idea to their ACTUAL biggest gaps (and protein if they're short). One sentence "why" per idea, naming the gap(s) it closes.
- These must be GENUINELY NEW — do NOT repeat or lightly reskin anything in the "avoid repeating" list; those are already covered by other sections of the email.
- Respect every remembered preference/constraint ABSOLUTELY (dislikes, allergies, what's kept stocked, time/equipment limits).
- Match the requested meal type and keep ideas real and accessible — not 15-ingredient recipes.
- Be concise. The "label" is a short dish name; the "why" is one tight sentence.

Respond ONLY with JSON: { "primaryNew": [{ "label": "...", "why": "..." }], "snackNew": [{ "label": "...", "why": "..." }] }`

const NEW_IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    primaryNew: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, why: { type: 'string' } },
        required: ['label', 'why'],
        additionalProperties: false,
      },
    },
    snackNew: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, why: { type: 'string' } },
        required: ['label', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['primaryNew', 'snackNew'],
  additionalProperties: false,
} as const

export interface NewIdeasRequest {
  primaryType: MealType
  primaryLimit: number
  snackType: MealType | null
  snackLimit: number
  context: string // buildCoachContext block
  avoid: string[] // labels already used by favorites/recent
}

export type NewIdeasFn = (
  req: NewIdeasRequest,
) => Promise<{ primaryNew: NewIdea[]; snackNew: NewIdea[] }>

/** Default "new ideas" generator — one gpt-5-mini structured call per slot. */
const defaultGenerateNewIdeas: NewIdeasFn = async (req) => {
  const openai = getOpenAI()
  const userMsg = [
    req.context,
    '',
    `Generate up to ${req.primaryLimit} NEW ${req.primaryType} idea(s) for "primaryNew".`,
    req.snackType
      ? `Also generate up to ${req.snackLimit} NEW ${req.snackType} idea(s) for "snackNew".`
      : 'Return an empty array for "snackNew".',
    req.avoid.length
      ? `Avoid repeating these (already shown elsewhere in the email): ${req.avoid.join('; ')}.`
      : '',
  ].join('\n')

  const completion = await openai.chat.completions.create({
    model: 'gpt-5-mini',
    messages: [
      { role: 'system', content: DIGEST_NEW_PROMPT },
      { role: 'user', content: userMsg },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'new_ideas', schema: NEW_IDEAS_SCHEMA, strict: true },
    },
  })

  const raw = JSON.parse(completion.choices[0]?.message?.content || '{}')
  const clean = (arr: unknown, limit: number): NewIdea[] =>
    (Array.isArray(arr) ? arr : [])
      .filter(
        (x): x is NewIdea =>
          !!x && typeof x.label === 'string' && typeof x.why === 'string' && x.label.trim().length > 0,
      )
      .map((x) => ({ label: x.label.trim(), why: x.why.trim() }))
      .slice(0, limit)

  return {
    primaryNew: clean(raw.primaryNew, req.primaryLimit),
    snackNew: clean(raw.snackNew, req.snackLimit),
  }
}

export interface BuildDigestOptions {
  today?: Date
  /** Injectable for previews/tests so we can render without calling OpenAI. */
  generateNewIdeas?: NewIdeasFn
  appUrl?: string
}

/**
 * Build the full digest (subject + HTML) for a slot. Favorites and recent picks
 * are computed deterministically from history and ranked by current gap-fit; the
 * "new" bucket is one LLM call covering both the primary meal and (if any) snack.
 */
export async function buildDigest(
  slot: DigestSlot,
  data: DigestData,
  options: BuildDigestOptions = {},
): Promise<{ subject: string; html: string; view: DigestView }> {
  const today = options.today ?? new Date()
  const generateNewIdeas = options.generateNewIdeas ?? defaultGenerateNewIdeas
  const appUrl = options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://longevity-diet.vercel.app'
  const spec = SLOTS[slot]

  const report = buildLongevityReport(data.meals, today)
  const tips = getRankedComponentTips(report).filter((t) => t.gapPoints >= 0.5)
  const topGaps: DigestGapView[] = tips
    .slice(0, 3)
    .map((t) => ({ label: t.label, gapPoints: t.gapPoints, kind: t.kind }))

  const proteinTarget = getProteinTarget(data.weightLbs, DEFAULT_PROTEIN_MULTIPLIER)
  const proteinCurrent = Math.round(getTodayProtein(data.meals, today))

  const windowItems = currentWindowItems(data.meals, today)

  // Deterministic favorites/recent per section.
  const sectionsDet = spec.sections.map((sec) => {
    const candidates = collectCandidates(data.meals, sec.type, today)
    const favorites = rankByGapFit(selectFavorites(candidates), windowItems, sec.limits.favorites)
    const recent = rankByGapFit(selectRecent(candidates, today), windowItems, sec.limits.recent)
    return { sec, favorites, recent }
  })

  // One AI call covering the primary section's new ideas + the snack's (if present).
  const primary = sectionsDet[0]
  const snack = sectionsDet[1] ?? null
  const avoid = sectionsDet
    .flatMap((s) => [...s.favorites, ...s.recent])
    .map((c) => c.label)

  const coachGaps: CoachContextGap[] = tips.map((t) => ({
    label: t.label,
    current: t.current,
    max: t.max,
    gapPoints: t.gapPoints,
    kind: t.kind,
  }))
  const context = buildCoachContext({
    rollingScore: report.rollingScore,
    rollingHasData: report.rollingHasData,
    componentGaps: coachGaps,
    proteinCurrent,
    proteinTarget,
    mealType: primary.sec.type,
    memories: data.memories,
  })

  let newIdeas: { primaryNew: NewIdea[]; snackNew: NewIdea[] } = { primaryNew: [], snackNew: [] }
  try {
    newIdeas = await generateNewIdeas({
      primaryType: primary.sec.type,
      primaryLimit: primary.sec.limits.fresh,
      snackType: snack ? snack.sec.type : null,
      snackLimit: snack ? snack.sec.limits.fresh : 0,
      context,
      avoid,
    })
  } catch (err) {
    // The email is still useful with favorites/recent only — never fail the send
    // because the novelty bucket couldn't be generated.
    console.error('Digest new-ideas generation failed:', err)
  }

  const sections: DigestSectionView[] = sectionsDet.map((s, i) => ({
    heading: s.sec.heading,
    favorites: s.favorites,
    recent: s.recent,
    fresh: i === 0 ? newIdeas.primaryNew : newIdeas.snackNew,
  }))

  const view: DigestView = {
    slot,
    greeting: spec.greeting,
    dateLabel: format(today, 'EEEE, MMMM d'),
    rollingScore: report.rollingScore,
    rollingHasData: report.rollingHasData,
    showProjectedGain: report.rollingHasData,
    weeklyDelta: report.weeklyDelta,
    topGaps,
    proteinCurrent,
    proteinTarget,
    sections,
    appUrl,
  }

  const topGapLabel = topGaps[0]?.label
  const subject = topGapLabel
    ? `${spec.subjectStem} to close your ${topGapLabel.toLowerCase()} gap`
    : `${spec.subjectStem} ideas to top off your longevity score`

  const html = renderDigestEmail(view)
  return { subject, html, view }
}
