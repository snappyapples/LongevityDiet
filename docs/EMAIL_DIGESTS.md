# Proactive Daily Email Digests

Three gap-aware emails a day that turn the meal coach from reactive ("ask what to
eat") into proactive ("here's what to eat next, already tuned to your gaps").

| Slot | Send (America/Denver) | Sections |
|---|---|---|
| Morning | 7:00 AM | Breakfast + mid-morning snack |
| Midday | 11:30 AM | Lunch + afternoon snack |
| Evening | 5:00 PM | Dinner |

Each meal section has three buckets: **Old favorites** (your consistent go-tos),
**Recent cravings** (newer things you tried once or twice), and **Something new**
(AI-invented, never logged). Every option is ranked/tuned to how much it would
move your *current* rolling-window gaps at send time.

## Architecture — Apps Script is the clock + mailman, Next.js is the brain

```
Apps Script time trigger (7:00 / 11:30 / 17:00, America/Denver)
      │  UrlFetchApp GET  APP_URL/api/digest?slot=…   (Authorization: Bearer DIGEST_SECRET)
      ▼
Next.js  /api/digest   ── service-role reads YOUR meals/settings/coach_memory
      │  gaps → favorites/recent buckets (deterministic) → "new" bucket (1 gpt-5-mini call)
      │  → render email-template → { subject, html }
      ▼
Apps Script  MailApp.sendEmail(you, subject, { htmlBody })   ← from your own Gmail, to you
```

Nothing schedules on Vercel — Apps Script's native time triggers fire in your
local timezone (no UTC math), and email is sent from your own Gmail (no Resend,
no domain verification, no DNS). This app is **single-user** by design.

## Key files

| File | Role |
|---|---|
| [src/lib/meal-history.ts](../src/lib/meal-history.ts) | Fingerprints past meals into "dishes", buckets them into favorites/recent, and ranks by `projectMealImpact` (re-scores the 7-day window with the candidate added). |
| [src/lib/email-digest.ts](../src/lib/email-digest.ts) | Orchestrator. Computes gaps/protein, assembles buckets per section, makes one `gpt-5-mini` call for the "new" bucket, returns `{ subject, html }`. Novelty generation is injectable (`generateNewIdeas`) for offline previews. |
| [src/lib/email-template.ts](../src/lib/email-template.ts) | Email-safe HTML (table layout, inline styles, no SVG) in the tree-ring green palette. |
| [src/lib/supabase-admin.ts](../src/lib/supabase-admin.ts) | Service-role client + `resolveDigestUserId()` (by `DIGEST_USER_ID` or `DIGEST_USER_EMAIL`). Server-only — bypasses RLS. |
| [src/app/api/digest/route.ts](../src/app/api/digest/route.ts) | `GET ?slot=morning\|midday\|evening`, Bearer-secret auth, `maxDuration = 60`. |
| [src/app/api/digest/preview/route.ts](../src/app/api/digest/preview/route.ts) | **Dev-only** preview (404 in prod). Synthetic week + canned "new" ideas, renders all three slots. |
| [apps-script/Code.gs](../apps-script/Code.gs) | The three trigger handlers, `UrlFetchApp` relay, `MailApp` send, and `installTriggers()`. |
| [apps-script/appsscript.json](../apps-script/appsscript.json) | Manifest — sets the `America/Denver` time zone. |

## The three buckets (how selection works)

Your logged meals already carry `categories` / `servings` / `protein` per item,
so favorites and recent are **deterministic** — no LLM guessing:

- **Fingerprint**: each meal → a normalized, sorted set of item names ("dish" identity).
- **Favorites**: a dish logged ≥3× in the last 90 days.
- **Recent cravings**: logged 1–2× within the last 21 days, not yet a favorite.
- **Rank**: `projectMealImpact(windowItems, candidateItems)` re-scores the current
  7-day window with the candidate's items added and returns the longevity-point +
  protein gain. Density normalization means a meal is scored by its *marginal*
  value given where you already are this week.
- **Something new**: one `gpt-5-mini` call, handed the same context the chat coach
  gets (via `buildCoachContext` — gaps, protein, and all `coach_memory` facts),
  told to avoid the favorite/recent dishes so "new" is genuinely new. If the call
  fails, the email still sends with favorites/recent only.

Tuning knobs live at the top of `meal-history.ts` (`MIN_FAVORITE_COUNT`,
`RECENT_WINDOW_DAYS`, `FAVORITE_LOOKBACK_DAYS`) and in the `SLOTS` bucket limits
in `email-digest.ts`.

## Environment variables

| Var | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Vercel + `.env.local` | `https://longevity-diet.vercel.app` (links in the email) |
| `DIGEST_SECRET` | Vercel + Apps Script Script Property | shared bearer token; rotate by changing both |
| `DIGEST_USER_EMAIL` | Vercel + `.env.local` | `justin.maner@gmail.com` — resolves the recipient's Supabase user id |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + `.env.local` | already set; used to read data without a session |

(`DIGEST_USER_ID` may be set instead of `DIGEST_USER_EMAIL` to skip the auth-admin lookup.)

## Local development / preview

```bash
npx next dev -p 3010 --webpack     # --webpack: project pins webpack via next-pwa
```

- Rendered preview (no auth, no OpenAI, synthetic data): http://localhost:3010/api/digest/preview
- Live endpoint locally:
  ```bash
  curl -s -H "Authorization: Bearer $DIGEST_SECRET" \
    "http://localhost:3010/api/digest?slot=morning" | jq -r .subject
  ```

## Deploying the schedule

1. **Vercel** → add `NEXT_PUBLIC_APP_URL`, `DIGEST_SECRET`, `DIGEST_USER_EMAIL`
   (and confirm `SUPABASE_SERVICE_ROLE_KEY`). Redeploy.
2. **Apps Script** (script.google.com → new project):
   - Paste `apps-script/Code.gs` and the manifest from `apps-script/appsscript.json`.
   - Script Properties: `APP_URL`, `DIGEST_SECRET` (same value as Vercel), optional `RECIPIENT`.
   - Run `installTriggers()` once; approve the Gmail + external-request scopes.
   - Run `testSendNow()` to send yourself the morning digest immediately.

## Roadmap

- Per-section subject lines (currently the subject names the single biggest overall gap).
- "Log this" deep-links from a suggested meal into the app.
- A `email_log` table if idempotency across retries ever becomes a concern (not
  needed with single-fire Apps Script triggers today).
