# Meal Coach

A conversational AI assistant (longevity mode only) that suggests meals to close your current nutrient + protein gaps, and **remembers your preferences** so it gets more useful over time.

## What it does

- Reachable from the speed-dial FAB → **Ask coach**.
- Opens a chat sheet. On every turn it's handed your live context: rolling longevity score, the ranked component gaps (`getRankedComponentTips`), today's protein vs. target, the meal-type of the current time of day, and **all of your stored coach-memory facts**.
- Replies conversationally with concrete meal ideas aimed at the 100% day.
- When you state a durable preference or constraint ("I don't like tofu", "I keep Greek yogurt and eggs stocked", "no time to cook on weekdays"), it proposes that as a **memory**. You confirm with one tap before it's saved — nothing is written silently.
- Stored memories persist in Supabase and are loaded into every future conversation.

Conversation history is **ephemeral** — it lives in component state and resets when you close the sheet. Only the memory persists. (Persisted conversation threads would be a future addition.)

## Architecture

```
Speed-dial FAB → "Ask coach"
      ↓
CoachSheet (chat UI, ephemeral message thread)
      ↓ POST /api/coach  { messages, context }
OpenAI gpt-5-mini → structured { reply, suggestedMemories[] }
      ↓
reply rendered in thread; suggestedMemories rendered as
"+ Remember: ..." confirm chips
      ↓ tap chip → POST /api/coach-memory
coach_memory table (Supabase, RLS per user)
```

### Key files

| File | Role |
|---|---|
| [src/app/api/coach/route.ts](../src/app/api/coach/route.ts) | Chat turn. Builds the context block, calls gpt-5-mini with structured output, returns `CoachResponse`. |
| [src/app/api/coach-memory/route.ts](../src/app/api/coach-memory/route.ts) | CRUD for `coach_memory` — GET (list), POST (add a fact), DELETE (`?id=`). |
| [src/lib/coach.ts](../src/lib/coach.ts) | `COACH_SYSTEM_PROMPT` + `buildCoachContext(report, proteinCurrent, proteinTarget, mealType, memories)` — the structured context string sent each turn. |
| [src/components/coach/CoachSheet.tsx](../src/components/coach/CoachSheet.tsx) | The chat sheet: message thread, input, memory-confirm chips, "manage memory" view. |
| [src/components/FloatingAddButton.tsx](../src/components/FloatingAddButton.tsx) | Speed-dial; gains an "Ask coach" entry when `onAskCoach` is supplied. |
| [src/types/index.ts](../src/types/index.ts) | `CoachMemory`, `CoachMessage`, `CoachResponse`. |

## Model choice

`gpt-5-mini` — meal ideation is a creative/reasoning task, not structured extraction, so `gpt-5-nano` (used by the meal parser) is the wrong tool. OpenAI applies automatic prompt caching to the stable system-prompt + memory block. If latency or quality becomes an issue, benchmark `gpt-5` vs `gpt-5-mini` before swapping (see the project's model-selection policy).

## Memory model

`coach_memory` rows are short, atomic facts. Two sources:

- `user` — you typed it into the manage-memory screen directly.
- `ai` — the coach proposed it and you tapped the confirm chip.

Memory **will** drift over time ("loves salmon" → "sick of salmon"), so the CoachSheet includes a manage view to edit/delete entries. Keep facts atomic — one preference per row — so they're easy to prune.

## Supabase schema

Run once in the Supabase SQL editor:

```sql
CREATE TABLE IF NOT EXISTS coach_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact text NOT NULL,
  source text NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'ai')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own coach memory"
  ON coach_memory FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS coach_memory_user_id_idx ON coach_memory (user_id);
```

## Roadmap

- **v1 (this):** chat sheet, gap + memory-aware suggestions, confirm-based memory writes, manage-memory view.
- **v2:** a "Log this" button on a suggested meal so the coach can write straight into your day.
- **Later:** persisted conversation threads; AI-assisted memory consolidation.
