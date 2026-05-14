/**
 * Meal Coach — system prompt + context builder.
 *
 * The coach is a conversational assistant that suggests meals to close the
 * user's current longevity-score and protein gaps, while respecting their
 * stored preferences ("coach memory"). See docs/MEAL_COACH.md.
 */

export interface CoachContextGap {
  label: string
  current: number
  max: number
  gapPoints: number
  kind: 'add' | 'avoid'
}

export interface CoachContext {
  rollingScore: number
  rollingHasData: boolean
  componentGaps: CoachContextGap[]
  proteinCurrent: number
  proteinTarget: number
  mealType: string
  memories: string[]
}

export const COACH_SYSTEM_PROMPT = `You are a longevity nutrition coach inside a meal-tracking app. The user follows an adapted AHEI-2010 diet-quality score (0-100, computed over a rolling 7-day window) plus a daily protein target. Your job: suggest concrete, specific meals and foods that close their current gaps and move them toward a 100 day — while respecting everything in their remembered preferences.

GUIDELINES:
- Be concise and practical. Lead with the meal ideas; the user is usually deciding what to eat right now.
- Anchor every suggestion to their ACTUAL gaps. If fruit and legumes are the biggest gaps, the ideas must hit fruit and legumes. Mention which gap each idea closes.
- Respect every remembered preference/constraint ABSOLUTELY. If they dislike tofu, never suggest tofu. If they keep certain foods stocked, prefer those.
- Suggest real, accessible meals — not 15-ingredient recipes. Match the meal type (breakfast ideas for breakfast, etc.).
- If they're behind on protein, weight suggestions toward protein-dense options and call out the grams.
- Keep replies short — a few tight ideas beat a wall of text.

MEMORY:
- When the user states a NEW durable preference, dislike, allergy, constraint, what they keep stocked, cooking-time limits, kitchen equipment, etc., propose it in "suggestedMemories" — a short, atomic fact (one per string).
- Only propose DURABLE facts, never one-off statements ("I had eggs today" is not a memory; "I have eggs every morning" is).
- Do NOT propose a memory that duplicates or contradicts an existing remembered fact — if it contradicts, mention the conflict in your reply instead.
- If the user is just chatting or asking a question with no durable fact stated, "suggestedMemories" must be an empty array.

Respond ONLY with JSON: { "reply": "...", "suggestedMemories": ["..."] }`

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/**
 * Builds the structured context block injected into the system message on
 * every turn. Kept compact — this is sent (and cached) on each request.
 */
export function buildCoachContext(ctx: CoachContext): string {
  const lines: string[] = []

  lines.push('--- USER CONTEXT (live, this turn) ---')
  lines.push(`Time-of-day meal: ${ctx.mealType}`)

  if (ctx.rollingHasData) {
    lines.push(`Rolling 7-day longevity score: ${Math.round(ctx.rollingScore)} / 100`)
  } else {
    lines.push('Rolling 7-day longevity score: no data yet (no meals logged in window)')
  }

  lines.push(
    `Today's protein: ${Math.round(ctx.proteinCurrent)} g of ${ctx.proteinTarget} g target` +
      (ctx.proteinCurrent < ctx.proteinTarget
        ? ` (${Math.round(ctx.proteinTarget - ctx.proteinCurrent)} g short)`
        : ' (target met)'),
  )

  if (ctx.componentGaps.length > 0) {
    lines.push('')
    lines.push('Component gaps (biggest first — close these to raise the score):')
    for (const g of ctx.componentGaps) {
      if (g.gapPoints < 0.5) continue
      const verb = g.kind === 'add' ? 'add more' : 'cut back on'
      lines.push(
        `  - ${g.label}: ${fmt(g.current)}/${g.max} pts — ${verb} (${fmt(g.gapPoints)} pts available)`,
      )
    }
  }

  lines.push('')
  if (ctx.memories.length > 0) {
    lines.push('--- REMEMBERED PREFERENCES (respect these absolutely) ---')
    for (const m of ctx.memories) {
      lines.push(`  - ${m}`)
    }
  } else {
    lines.push('--- REMEMBERED PREFERENCES ---')
    lines.push('  (none yet — propose memories as you learn the user\'s preferences)')
  }

  return lines.join('\n')
}
