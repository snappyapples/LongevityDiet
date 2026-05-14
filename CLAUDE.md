# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
npm run start    # Start production server
```

## Architecture Overview

FitnessLove is a Next.js 16 nutrition tracking app with AI-powered meal logging. Users describe meals in natural language and GPT-5-mini parses them into individual food items with nutritional values and longevity categories. The app has two scoring modes: **Longevity** (default, adapted AHEI-2010 0-100 score) and **Macros** (calories/protein/fiber efficiency view). Users toggle between them in Settings; both modes read the same meal data.

### Tech Stack
- Next.js 16 (App Router)
- React 19
- Tailwind CSS 4
- Supabase (database + auth)
- OpenAI API (gpt-5-mini for meal parsing + longevity classification)
- shadcn/ui components

### Key Data Flow

1. **Meal Logging**: User describes meal → `POST /api/parse-meal` → OpenAI parses text AND classifies each item into longevity categories → returns `FoodItem[]` → User confirms → `POST /api/meals` → Supabase
2. **Authentication**: Email + password via Supabase Auth → AuthProvider manages session state → redirects to `/` on success
3. **Data Fetching**:
   - Macros mode: `GET /api/meals?days=7` → aggregates into `DayData[]`
   - Longevity mode: `GET /api/meals?days=14` → client computes `LongevityReport` via `buildLongevityReport()` (14 days needed for current-vs-prior-7d delta)
4. **Dashboard Routing**: The root `Dashboard` component reads `settings.scoringMode` and renders either `MacrosDashboard` (original) or `LongevityDashboard` (new).
5. **Quick Log**: The longevity view renders a `QuickLogInput` card between the score ring and the day list. Meal type is auto-picked from time of day (breakfast 04:00–10:30, lunch 10:30–15:00, dinner 15:00–20:30, snack otherwise). Two flows — "Log it" and "Evaluate" — both parse via the same `/api/parse-meal` endpoint, show parsed items + a rolling-score delta preview with per-component gain chips, and require confirmation before saving. Mindfulness inputs (hunger/calm) are hidden in longevity mode via the `hideMindfulness` prop on `LogMealSheet`.
6. **Meal Coach**: The speed-dial FAB has an "Ask coach" entry that opens `CoachSheet` — a conversational assistant (gpt-5-mini) that suggests meals to close the user's current nutrient + protein gaps and has **persistent memory** of preferences. `POST /api/coach` takes the conversation + a live context block (gaps, protein, meal type, memories); `/api/coach-memory` is CRUD for the `coach_memory` Supabase table. AI-proposed memories require one-tap user confirmation before they're saved. See [docs/MEAL_COACH.md](docs/MEAL_COACH.md).

### Auth Architecture

- **Middleware** (`src/middleware.ts`): Runs on every request, syncs auth cookies between client and server
- **AuthProvider** (`src/components/auth/AuthProvider.tsx`): Client-side context for user state, provides `signIn(email, password)` method using `signInWithPassword()`
- **AuthGuard**: Wraps protected pages, redirects to `/login` if not authenticated
- **User Management**: Users are created manually in Supabase dashboard (Authentication > Users > Add User). No self-registration.

### Scoring Systems

Two independent scoring systems; which one is displayed is controlled by `settings.scoringMode`.

**Longevity (default)** — adapted AHEI-2010 0-100 score. The score is a **pure 7-day rolling window**, computed in one shot from all items in the last 7 days (not an average of daily scores). 10 components (6 positive density-normalized + 1 weekly fish + 3 reverse-scored harm categories) sum to 100. Logging any item moves the score by exactly its contribution to the window totals — no daily reset, no empty-day math. The main card shows the headline score plus a ranked list of all 10 components (biggest gap first), each with an add/avoid icon and a concrete food tip. Components within 0.5 pts of max collapse into a "dialed in" footer. The 4 grouped subscores (Plants / Fat Quality / Protein Quality / Harm Reduction) are still rendered on per-day cards for pattern-spotting.

In addition to the 0-100 score, a **separate daily protein rail** lives inside the same card (Attia-style target = `weight × 0.7 g/lb` by default). It tracks today's protein grams against the daily target — *not* rolling — because muscle protein synthesis resets each day. Protein is intentionally NOT folded into the AHEI 0-100 score; the two operate on different physiology and time horizons.

See [docs/LONGEVITY_SCORE.md](docs/LONGEVITY_SCORE.md) for the full model, scoring library, and UI component map.

**Macros (legacy)** — three metrics from `src/types/index.ts`:
- **Calories**: 100% if under goal, degrades to 0 at 120% of goal
- **Protein**: Linear 0-100% as you approach goal
- **Fiber**: Linear 0-100% as you approach goal

Overall macros daily score = equal weight (33.3% each). Color coding uses efficiency index: `(nutrientPercent / caloriePercent) * 100` — green ≥100%, yellow ≥67%, red <67%.

### Mindful Eating Report

The app tracks emotional eating patterns via `src/lib/mindfulness.ts`:
- **Calm Level** (stored as `stressLevel` in DB): 1-5 scale where 5 = very calm. Threshold for "eating when calm" is 4-5.
- **Hunger Level**: 1-5 scale where 5 = starving. Sweet spot for "eating when hungry" is 3-4 (not starving, not bored).
- Report shows weekly percentages, day-by-day trends, and breakdown by meal type.

### File Organization

```
src/
├── app/
│   ├── api/
│   │   ├── meals/route.ts      # CRUD for meals (Supabase)
│   │   ├── settings/route.ts   # User settings incl. scoring_mode
│   │   ├── parse-meal/route.ts # OpenAI meal parsing + classification (gpt-5-nano)
│   │   ├── coach/route.ts      # Meal-coach chat turn (gpt-5-mini, structured output)
│   │   └── coach-memory/route.ts # CRUD for coach_memory (Supabase)
│   └── login/page.tsx          # Email/password login page
├── components/
│   ├── auth/                   # AuthProvider, AuthGuard
│   ├── coach/                  # CoachSheet — conversational meal-idea assistant
│   ├── dashboard/
│   │   ├── Dashboard.tsx           # Router — branches on scoringMode
│   │   ├── DayCard.tsx             # Macros-mode day card
│   │   ├── DailyMetrics.tsx        # Macros-mode 3-metric row
│   │   ├── MealRow.tsx             # Mode-aware: efficiency (macros) vs chips (longevity)
│   │   ├── MindfulnessReport.tsx   # Hunger/calm weekly report
│   │   ├── LongevityDashboard.tsx  # Rolling score card + quick-log + subscores + day list + tip
│   │   ├── LongevityDayCard.tsx    # Longevity-mode day card
│   │   ├── LongevityScoreRing.tsx  # Reusable 0-100 ring
│   │   ├── LongevitySubscoreBar.tsx # Horizontal filled bar for subscores (used in day cards only)
│   │   ├── LongevityComponentList.tsx # Ranked 10-component list w/ tips + add/avoid icons + expand/dialed-in footer (main card)
│   │   ├── ProteinRail.tsx         # Daily protein bar inside main card (Attia target, not folded into 0-100 score)
│   │   ├── LongevityHelpSheet.tsx  # In-app "how the score works" explainer
│   │   ├── QuickLogInput.tsx       # Inline quick-add with Log-it / Evaluate flows + rolling-delta preview
│   │   └── CategoryChips.tsx       # Shared chip rendering for food categories
│   ├── logging/                # LogMealSheet (accepts hideMindfulness prop for longevity mode)
│   ├── settings/               # SettingsSheet (incl. Macros/Longevity toggle)
│   └── ui/                     # shadcn components
├── lib/
│   ├── supabase.ts             # Client-side Supabase (uses @supabase/ssr browser client)
│   ├── supabase-server.ts      # Server-side Supabase (uses cookies)
│   ├── openai.ts               # OpenAI client + PARSE_MEAL_PROMPT (with longevity categories)
│   ├── mindfulness.ts          # Mindful eating calculations and thresholds
│   ├── protein-target.ts       # Attia-style daily protein target (weight × multiplier) + today's protein sum
│   ├── coach.ts                # Meal-coach system prompt + buildCoachContext
│   ├── parse-cache.ts          # localStorage cache for parsed meals (parseWithCache)
│   └── longevity-score.ts      # scoreWindow (rolling), scoreDay (per-day card), buildLongevityReport, getRankedComponentTips
├── middleware.ts               # Auth session sync on every request
└── types/index.ts              # All TypeScript types + macros scoring logic
```

### API Authentication

All API routes use `getServerUser()` from `lib/supabase-server.ts` to get the authenticated user. Returns 401 if no session. The `user.id` is used for all database queries.

### Environment Variables

Required in `.env.local`:
- `OPENAI_API_KEY` - For meal parsing
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

### Supabase Tables

- `meals`: id, user_id, type, date, items (jsonb), total_calories, total_protein, total_fiber, context (jsonb), created_at
  - Each item in the `items` jsonb includes: `id, name, calories, protein, fiber, quantity?, categories?, servings?, processingLevel?`. The longevity fields (last three) are populated by the parser; legacy pre-backfill items leave them `undefined` and the UI treats them accordingly.
- `settings`: user_id (PK), age, sex, height_feet, height_inches, weight, activity_level, calorie_goal, protein_goal, fiber_goal, scoring_mode, updated_at
  - `scoring_mode`: `'macros'` or `'longevity'` (default `'longevity'`). Added via SQL migration — see [docs/LONGEVITY_SCORE.md](docs/LONGEVITY_SCORE.md).
- `coach_memory`: id, user_id, fact (text), source (`'user'|'ai'`), created_at
  - Persistent meal-coach memory. Added via SQL migration — see [docs/MEAL_COACH.md](docs/MEAL_COACH.md). RLS-scoped per user.

## Documentation

- [docs/LONGEVITY_SCORE.md](docs/LONGEVITY_SCORE.md) — full longevity scoring model, UI component map, helpers, implementation notes.
- [docs/MEAL_COACH.md](docs/MEAL_COACH.md) — conversational meal-coach: architecture, system prompt, memory model, `coach_memory` migration.
- [docs/BACKFILL.md](docs/BACKFILL.md) — one-off re-classifier script usage, `FORCE_TERMS` targeted re-classification.
