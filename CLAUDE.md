# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deployment Workflow — Ship Directly to Prod

This is a solo personal project (`snappyapples/LongevityDiet`, personal git identity `justin.maner@gmail.com`). **Standing authorization: commit and push to `master` and let it deploy to production without asking each time.** This overrides the global "never push without explicit approval" and "branch off the default branch first" rules — here, commit straight to `master` and push. Vercel auto-deploys on push; Justin tests on prod ([longevity-diet.vercel.app](https://longevity-diet.vercel.app)) and is fine fixing forward if something breaks.

Guardrails that still apply: run `npm run build` (project pins webpack — dev/build need the `--webpack` flag) or at least `npx tsc --noEmit` before pushing so obvious breakage is caught, and report what was deployed + the Vercel result.

## Development Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Start production server
npm run icons    # Regenerate public PNG icons from src/app/icon.svg
```

### Icon assets

The master mark lives at `src/app/icon.svg` (Next.js auto-favicon — tree-rings cross-section in nutrition-green). The Logo component (`src/components/Logo.tsx`) renders an inline copy of the same mark.

`npm run icons` regenerates the PNG variants required for iOS + PWA:

- `public/apple-touch-icon.png` (180×180)
- `public/icons/icon-192x192.png` (PWA "any maskable")
- `public/icons/icon-512x512.png` (PWA "any maskable", also used for splash)

Maskable PNGs are flattened onto a green-soft (`#C5E1A5`) background so corners are filled — Android adaptive-icon masks may crop them. After editing `src/app/icon.svg` AND the inline copy in `Logo.tsx`, run `npm run icons` and commit the regenerated PNGs together.

## Architecture Overview

Longevity Diet is a Next.js 16 nutrition tracking app focused exclusively on a longevity diet score. Live at [longevity-diet.vercel.app](https://longevity-diet.vercel.app); GitHub repo `snappyapples/LongevityDiet`. (The local working folder is still named `FitnessLove` — cosmetic only, not worth the churn of renaming the cwd.) Users log meals in natural language; OpenAI (`gpt-5-nano`) parses them into individual ingredients with AHEI-2010 longevity categories. The app displays a single 0–100 rolling longevity score, a daily protein rail (Attia-style), a ranked "what to eat next" list, and an AI meal coach with persistent memory.

The macros / calorie-protein-fiber view, the mindful-eating layer, and the inline quick-log input were all removed in the v2 simplification — longevity is now the only mode.

### Tech Stack
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Supabase (database + auth)
- OpenAI API — `gpt-5-nano` for meal parsing (cheap, structured output), `gpt-5-mini` for the meal coach (reasoning)
- shadcn/ui components

### Key Data Flow

1. **Meal Logging**: Floating `+` button (speed-dial) → pick a meal type → `LogMealSheet` opens → user types meal description → `POST /api/parse-meal` parses + classifies items → user reviews/edits → `POST /api/meals` writes to Supabase. The save is **optimistic**: the meal lands in local state instantly, the network round-trip happens in the background, and the local entry is reconciled with the server-returned row.
2. **Authentication**: Email + password via Supabase Auth → `AuthProvider` manages session → redirects to `/` on success.
3. **Data Fetching**: `GET /api/meals?days=14` → client computes `LongevityReport` via `buildLongevityReport()` (14 days = current 7-day window + prior 7-day window for the delta).
4. **Meal Coach**: The speed-dial FAB has an "Ask coach" entry that opens `CoachSheet` — a conversational assistant (`gpt-5-mini`) that suggests meals to close the user's current nutrient + protein gaps and has **persistent memory** of preferences. `POST /api/coach` takes the conversation + a live context block (gaps, protein, meal type, memories); `/api/coach-memory` is CRUD for the `coach_memory` Supabase table. AI-proposed memories require one-tap user confirmation before they're saved. See [docs/MEAL_COACH.md](docs/MEAL_COACH.md).
5. **Parse cache**: `src/lib/parse-cache.ts` keeps a `localStorage` LRU of recent parses so re-logging the same description ("oatmeal with berries") skips the OpenAI call entirely.

### Auth Architecture

- **Middleware** (`src/middleware.ts`): Runs on every request, syncs auth cookies between client and server.
- **AuthProvider** (`src/components/auth/AuthProvider.tsx`): Client-side context for user state, provides `signIn(email, password)` method using `signInWithPassword()`.
- **AuthGuard**: Wraps protected pages, redirects to `/login` if not authenticated.
- **Public routes** (no `AuthGuard`): `/login`, `/about`. The `/about` page is the public-facing philosophy / marketing page.
- **User Management**: Users are created manually in Supabase dashboard (Authentication → Users → Add User). No self-registration.

### Public marketing page (`/about`)

`src/app/about/page.tsx` is a static, server-rendered marketing page (no auth, no client state). Sections: hero → "what to eat vs. what not to" framing → 10-component grid (7 positives + 3 negatives, color-coded with point values) → how-it-works (density / rolling window / protein / AI) → link to the 7-day reference plan → science section → references (10 inline footnotes with PubMed links) → final CTA.

The page links to `/weekly-plan.html` — a copy of `docs/weekly-plan.html` placed in `public/` so it serves as a static asset. **Keep them in sync** if you edit the weekly plan: edit `public/weekly-plan.html` (the live one) and copy back to `docs/` for the canonical reference, or treat `docs/weekly-plan.html` as the source of truth and re-copy after edits.

The 10-component data (icon, name, max points, kind=add/avoid, why) is hard-coded in `about/page.tsx` — intentionally not pulled from `longevity-score.ts` because the marketing copy is editorial. If you change scoring weights, update both.

### Scoring

Adapted AHEI-2010 0–100 score, computed as a **pure 7-day rolling window** (not an average of daily scores). 10 components — 6 positive density-normalized per 1,000 kcal (vegetables, fruit, legumes/soy, whole grains, nuts/seeds, healthy fat) + 1 weekly protective (fatty fish) + 3 reverse-scored harm (sugary drinks, red/processed meat, ultra-processed) — sum to 100. Logging any item moves the score by exactly its contribution to the window totals; no daily reset, no empty-day math.

**Dashboard layout (v3, primary surface is now the per-day card):**

- Top card (compact): the 7-day rolling score (small ring), delta vs prior week, and a **collapsed-by-default** "What to eat next" section that expands to show the full 10-component ranked list. The headline rolling score lives here but is deliberately less prominent than the per-day breakdown below.
- Each day card (expanded): 2×2 grid of the **four subscores** (Plants 50 / Fat 10 / Fish 10 / Harm 30) for that day, plus a daily **protein rail** below it (rendered on every day, not just today), then meal rows. The five things together — four longevity subscores + protein — are the daily target set you can scroll back through and see "where I got to" for any day in the window. The per-day subscores serve as a richer "what to eat next" cue than the headline ranked list, because they're scoped to the day in front of you.

**Daily protein** is a separate rail, NOT folded into the 0–100 score. Target = `weight × 0.7 g/lb` (Attia "gentle"). Protein resets each day — different physiology from AHEI. The catch-up tip ("behind for today — try Greek yogurt…") only appears for today after 5pm; historical days show just the bar + score. See [docs/LONGEVITY_SCORE.md](docs/LONGEVITY_SCORE.md).

### File Organization

```
src/
├── app/
│   ├── api/
│   │   ├── meals/route.ts         # CRUD for meals (Supabase, optimistic on the client)
│   │   ├── settings/route.ts      # User weight (the only field currently surfaced)
│   │   ├── parse-meal/route.ts    # OpenAI meal parsing + classification (gpt-5-nano)
│   │   ├── coach/route.ts         # Meal-coach chat turn (gpt-5-mini, structured output)
│   │   └── coach-memory/route.ts  # CRUD for coach_memory (Supabase)
│   ├── about/page.tsx             # Public marketing page (no auth) — philosophy + 10 components + citations
│   ├── login/page.tsx             # Email/password login page (links to /about)
│   └── page.tsx                   # Home (header + Dashboard, has About link)
├── components/
│   ├── auth/                      # AuthProvider, AuthGuard
│   ├── coach/                     # CoachSheet — conversational meal-idea assistant
│   ├── dashboard/
│   │   ├── Dashboard.tsx              # Thin wrapper around LongevityDashboard
│   │   ├── LongevityDashboard.tsx     # Compact 7-day card + collapsible "What to eat next" + day list
│   │   ├── LongevityDayCard.tsx       # Per-day card; expanded view renders DaySubscores + (today) ProteinRail + meals
│   │   ├── LongevityScoreRing.tsx     # Reusable 0–100 ring
│   │   ├── LongevityComponentList.tsx # 10-component ranked list (collapsed by default via defaultOpen prop)
│   │   ├── DaySubscores.tsx           # 2×2 grid of the 4 subscores (Plants/Fat/Fish/Harm) for a single day
│   │   ├── ProteinRail.tsx            # Daily protein bar (Attia target) — rendered in every expanded day card; isToday gates the catch-up tip
│   │   ├── LongevityHelpSheet.tsx     # In-app "how the score works" explainer
│   │   ├── MealRow.tsx                # Meal row inside day cards (category chips)
│   │   └── CategoryChips.tsx          # Shared chip rendering for food categories
│   ├── logging/                   # LogMealSheet — opened by the FAB
│   ├── settings/                  # SettingsSheet (just weight, drives the protein target)
│   ├── FloatingAddButton.tsx      # Speed-dial FAB (meal types + Ask coach)
│   ├── Logo.tsx
│   └── ui/                        # shadcn components
├── lib/
│   ├── supabase.ts                # Client-side Supabase (uses @supabase/ssr browser client)
│   ├── supabase-server.ts         # Server-side Supabase (uses cookies)
│   ├── openai.ts                  # OpenAI client + PARSE_MEAL_PROMPT
│   ├── longevity-score.ts         # scoreWindow, scoreDay, buildLongevityReport, getRankedComponentTips
│   ├── protein-target.ts          # Daily protein target (weight × multiplier) + today's protein sum
│   ├── coach.ts                   # Meal-coach system prompt + buildCoachContext
│   └── parse-cache.ts             # localStorage cache for parsed meals (parseWithCache)
├── middleware.ts                  # Auth session sync on every request
└── types/index.ts                 # All TypeScript types (longevity + coach)
```

### API Authentication

All API routes use `getServerUser()` from `lib/supabase-server.ts` to get the authenticated user. Returns 401 if no session. The `user.id` is used for all database queries.

### Environment Variables

Required in `.env.local`:
- `OPENAI_API_KEY` — for meal parsing + coach
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

Optional (for one-off inspection scripts):
- `SUPABASE_SERVICE_ROLE_KEY` — used by `scripts/inspect-coach-data.mjs` to read data via RLS bypass. Do not commit. Rotate after use.

For the proactive email digests (see [docs/EMAIL_DIGESTS.md](docs/EMAIL_DIGESTS.md)) — set locally and in Vercel:
- `SUPABASE_SERVICE_ROLE_KEY` — the `/api/digest` endpoint reads meals/settings/memory without a session
- `NEXT_PUBLIC_APP_URL` — base URL for links in the email (`https://longevity-diet.vercel.app`)
- `DIGEST_SECRET` — shared bearer token the Apps Script sender presents to `/api/digest`
- `DIGEST_USER_EMAIL` (or `DIGEST_USER_ID`) — identifies the single digest recipient

### Supabase Tables

- `meals`: `id, user_id, type, date, items (jsonb), total_calories, total_protein, total_fiber, context (jsonb), created_at`
  - Each item in the `items` jsonb: `id, name, calories, protein, fiber, quantity?, categories?, servings?, processingLevel?`. Longevity classification fields are populated by the parser; legacy pre-backfill items leave them `undefined` and the UI handles that.
  - `context.notes` is the only field currently written. Older rows may still have `hungerLevel`/`stressLevel`/`ateWithOthers` from the dropped mindfulness layer — they're inert.
- `settings`: `user_id (PK), weight, updated_at` (the columns the app reads/writes). Several legacy columns from the dropped macros mode (`age, sex, height_feet, height_inches, activity_level, calorie_goal, protein_goal, fiber_goal, scoring_mode`) still exist in the table but are ignored by the API. A future migration can drop them.
- `coach_memory`: `id, user_id, fact (text), source ('user'|'ai'), created_at`
  - Persistent meal-coach memory. Added via SQL migration — see [docs/MEAL_COACH.md](docs/MEAL_COACH.md). RLS-scoped per user.

## Documentation

- [docs/LONGEVITY_SCORE.md](docs/LONGEVITY_SCORE.md) — full longevity scoring model, UI component map, helpers, implementation notes.
- [docs/MEAL_COACH.md](docs/MEAL_COACH.md) — conversational meal-coach: architecture, system prompt, memory model, `coach_memory` migration.
- [docs/EMAIL_DIGESTS.md](docs/EMAIL_DIGESTS.md) — proactive daily email digests (Apps Script scheduler + Gmail send, `/api/digest`, favorites/recent/new bucket logic).
- [docs/BACKFILL.md](docs/BACKFILL.md) — one-off re-classifier script usage, `FORCE_TERMS` targeted re-classification.
- [docs/weekly-plan.html](docs/weekly-plan.html) — reference HTML modeling a 7-day eating pattern that hits every AHEI target + 154 g protein/day.
