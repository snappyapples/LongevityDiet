// Benchmark models for the app's three OpenAI tasks: parse-meal, coach, digest "new ideas".
// Usage: node scripts/bench-models.mjs [parse|coach|digest|all] [model ...]   (reads OPENAI_API_KEY from .env.local)
// Prompts are imported from src (Node strips the TS types). Reports latency, token usage and a quality check.

import { readFileSync } from 'fs'
import OpenAI from 'openai'
import { PARSE_MEAL_PROMPT } from '../src/lib/openai.ts'
import { COACH_SYSTEM_PROMPT, buildCoachContext } from '../src/lib/coach.ts'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] })
)
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || env.OPENAI_API_KEY })

const [task = 'all', ...argModels] = process.argv.slice(2)
const DEFAULTS = {
  parse: ['gpt-5-nano', 'gpt-5.6-luna', 'gpt-6-luna'],
  coach: ['gpt-5-mini', 'gpt-5.6-luna', 'gpt-6-luna', 'gpt-5.6-terra'],
  digest: ['gpt-5-mini', 'gpt-5.6-luna', 'gpt-6-luna', 'gpt-5.6-terra'],
}
const RUNS = 3

// The digest prompt is a module-private const in email-digest.ts (whose imports Node can't resolve).
const DIGEST_NEW_PROMPT = readFileSync('src/lib/email-digest.ts', 'utf8').match(/const DIGEST_NEW_PROMPT = `([\s\S]*?)`\n/)[1]

const CATEGORIES = ['vegetable', 'leafy_crucifer', 'fruit', 'legume_soy', 'whole_grain', 'nut_seed', 'healthy_fat', 'fish_omega3', 'red_meat', 'processed_meat', 'sugary_drink', 'ultra_processed']
// Same as RESPONSE_SCHEMA in src/app/api/parse-meal/route.ts
const PARSE_SCHEMA = { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: {
  name: { type: 'string' }, calories: { type: 'number' }, protein: { type: 'number' }, fiber: { type: 'number' }, quantity: { type: ['string', 'null'] },
  categories: { type: 'array', items: { type: 'string', enum: CATEGORIES } },
  servings: { type: 'array', items: { type: 'object', properties: { category: { type: 'string', enum: CATEGORIES }, amount: { type: 'number' } }, required: ['category', 'amount'], additionalProperties: false } },
}, required: ['name', 'calories', 'protein', 'fiber', 'quantity', 'categories', 'servings'], additionalProperties: false } } }, required: ['items'], additionalProperties: false }
const COACH_SCHEMA = { type: 'object', properties: { reply: { type: 'string' }, suggestedMemories: { type: 'array', items: { type: 'string' } } }, required: ['reply', 'suggestedMemories'], additionalProperties: false }
const IDEA = { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, why: { type: 'string' } }, required: ['label', 'why'], additionalProperties: false } }
const DIGEST_SCHEMA = { type: 'object', properties: { primaryNew: IDEA, snackNew: IDEA }, required: ['primaryNew', 'snackNew'], additionalProperties: false }

// Parse cases: expected categories (must appear somewhere) and forbidden ones (must not).
const MEALS = [
  { text: 'rotisserie chicken Costco green salad', minItems: 3, want: ['leafy_crucifer', 'ultra_processed'], never: ['red_meat'] },
  { text: 'oatmeal with blueberries, walnuts and a spoon of peanut butter', minItems: 2, want: ['whole_grain', 'fruit', 'nut_seed'], never: ['legume_soy'] },
  { text: 'orange chicken and fried rice from Panda Express', minItems: 2, want: ['ultra_processed'], never: ['red_meat', 'healthy_fat'] },
  { text: 'tuna sandwich on whole wheat with a can of Coke', minItems: 2, want: ['whole_grain', 'sugary_drink'], never: ['fish_omega3'] },
  { text: 'grilled salmon with quinoa and roasted broccoli', minItems: 3, want: ['fish_omega3', 'whole_grain', 'leafy_crucifer'], never: [] },
]
function scoreParse(text, m) {
  const items = JSON.parse(text).items || []
  const cats = new Set(items.flatMap((i) => i.categories))
  const miss = []
  if (items.length < m.minItems) miss.push(`items=${items.length}`)
  for (const c of m.want) if (!cats.has(c)) miss.push(`-${c}`)
  for (const c of m.never) if (cats.has(c)) miss.push(`+${c}`)
  return { score: miss.length ? 0 : 1, note: miss.length ? `${m.text.slice(0, 25)}: ${miss.join(' ')}` : '' }
}

const CTX = {
  rollingScore: 58, rollingHasData: true, proteinCurrent: 62, proteinTarget: 140, mealType: 'dinner',
  componentGaps: [
    { label: 'Legumes & soy', current: 2, max: 10, gapPoints: 8, kind: 'add' },
    { label: 'Fruit', current: 4, max: 10, gapPoints: 6, kind: 'add' },
    { label: 'Ultra-processed', current: 6, max: 10, gapPoints: 4, kind: 'avoid' },
  ],
  memories: ['Dislikes tofu', 'Keeps canned chickpeas and black beans stocked', 'Weeknight dinners must take under 20 minutes'],
}
const COACH_TURNS = [
  { q: 'What should I make for dinner tonight?', memory: false },
  { q: 'I\'m allergic to shellfish, by the way. Any high-protein ideas?', memory: true },
]
function scoreCoach(text, t) {
  const p = JSON.parse(text)
  const miss = []
  if (/tofu/i.test(p.reply) && !/no tofu|without tofu|skip(ping)? tofu|not tofu|tofu-free/i.test(p.reply)) miss.push('suggested tofu')
  if (!/chickpea|bean|lentil|legume|edamame/i.test(p.reply)) miss.push('no legume')
  if (t.memory && !p.suggestedMemories.some((m) => /shellfish/i.test(m))) miss.push('missed shellfish memory')
  if (!t.memory && p.suggestedMemories.length) miss.push(`spurious memory: ${p.suggestedMemories[0]}`)
  if (p.reply.length > 1500) miss.push(`long reply ${p.reply.length}`)
  return { score: miss.length ? 0 : 1, note: miss.join(', '), len: p.reply.length }
}
const DIGEST_USER = [buildCoachContext(CTX), '', 'Generate up to 2 NEW dinner idea(s) for "primaryNew".', 'Also generate up to 1 NEW snack idea(s) for "snackNew".',
  'Avoid repeating these (already shown elsewhere in the email): Black bean tacos; Chickpea curry.'].join('\n')
function scoreDigest(text) {
  const p = JSON.parse(text)
  const miss = []
  if (p.primaryNew.length < 1 || p.primaryNew.length > 2) miss.push(`primary=${p.primaryNew.length}`)
  if (p.snackNew.length < 1 || p.snackNew.length > 1) miss.push(`snack=${p.snackNew.length}`)
  const all = [...p.primaryNew, ...p.snackNew]
  if (all.some((x) => /tofu/i.test(x.label))) miss.push('tofu')
  if (all.some((x) => /black bean taco|chickpea curry/i.test(x.label))) miss.push('repeat')
  return { score: miss.length ? 0 : 1, note: miss.join(', ') }
}

const schemaFmt = (name, schema) => ({ type: 'json_schema', json_schema: { name, schema, strict: true } })

async function bench(name, models, calls) {
  const rows = []
  for (const model of models) {
    const times = [], inTok = [], outTok = [], notes = []
    let ok = 0, total = 0, sample = ''
    for (let r = 0; r < RUNS; r++) {
      for (const c of calls) {
        total++
        const t0 = Date.now()
        try {
          const res = await client.chat.completions.create({ model, messages: c.messages, response_format: c.format })
          times.push(Date.now() - t0)
          inTok.push(res.usage?.prompt_tokens || 0)
          outTok.push(res.usage?.completion_tokens || 0)
          const text = res.choices[0]?.message?.content || '{}'
          const s = c.score(text)
          ok += s.score
          if (s.note) notes.push(s.note)
          if (!sample) sample = text.replace(/\s+/g, ' ').slice(0, 260)
        } catch (e) {
          notes.push(`ERROR ${e.status || ''} ${String(e.message).slice(0, 100)}`)
        }
      }
    }
    const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0)
    rows.push({ model, avgMs: avg(times), minMs: Math.min(...times), maxMs: Math.max(...times), q: `${ok}/${total}`, tok: `${avg(inTok)}/${avg(outTok)}`, notes, sample })
  }
  rows.sort((a, b) => a.avgMs - b.avgMs)
  console.log(`\n## ${name}\n| Model | Avg ms | Min | Max | Quality | Avg in/out tokens |\n|---|---|---|---|---|---|`)
  for (const r of rows) console.log(`| ${r.model} | ${r.avgMs} | ${r.minMs} | ${r.maxMs} | ${r.q} | ${r.tok} |`)
  for (const r of rows) console.log(`- ${r.model}: ${r.notes.length ? 'misses: ' + [...new Set(r.notes)].join('; ') + ' | ' : ''}sample: ${r.sample}`)
}

if (task === 'all' || task === 'parse')
  await bench('parse-meal', argModels.length ? argModels : DEFAULTS.parse, MEALS.map((m) => ({
    messages: [{ role: 'user', content: PARSE_MEAL_PROMPT + m.text }], format: schemaFmt('parsed_meal', PARSE_SCHEMA), score: (t) => scoreParse(t, m),
  })))
if (task === 'all' || task === 'coach')
  await bench('coach', argModels.length ? argModels : DEFAULTS.coach, COACH_TURNS.map((t) => ({
    messages: [{ role: 'system', content: `${COACH_SYSTEM_PROMPT}\n\n${buildCoachContext(CTX)}` }, { role: 'user', content: t.q }],
    format: schemaFmt('coach_response', COACH_SCHEMA), score: (x) => scoreCoach(x, t),
  })))
if (task === 'all' || task === 'digest')
  await bench('digest new ideas', argModels.length ? argModels : DEFAULTS.digest, [{
    messages: [{ role: 'system', content: DIGEST_NEW_PROMPT }, { role: 'user', content: DIGEST_USER }],
    format: schemaFmt('new_ideas', DIGEST_SCHEMA), score: scoreDigest,
  }])
