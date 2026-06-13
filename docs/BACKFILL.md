# Meal Backfill & Re-classification

The [`scripts/backfill-longevity.mjs`](../scripts/backfill-longevity.mjs) script re-classifies existing meals with longevity categories, servings, and processing levels. It's needed because category data didn't exist before the longevity scoring was added — historical meals had to be tagged retroactively.

## When to run it

- **Once, after enabling longevity scoring for the first time** — populates historical meals so the 7-day rolling average is meaningful from day one. Already completed.
- **When you tighten the classification prompt** — re-run with `FORCE_TERMS` targeting items likely affected (e.g. poultry after fixing the "chicken is not red meat" rule).
- **Ad-hoc** — if you notice a specific item consistently misclassified, fix the prompt, run with a narrow `FORCE_TERMS` to fix that subset.

## How it works

1. Signs in as the user via Supabase Auth (`signInWithPassword`) so RLS allows reads/writes.
2. Fetches all meals for that user.
3. Filters down to meals that need processing:
   - Any item has `categories === undefined` (never classified), OR
   - `FORCE_TERMS` is set and any item's name contains a listed substring.
4. For each matching meal, sends the items to GPT-5-mini with the classification prompt.
5. Updates the `items` jsonb in place. Preserves existing `calories`, `protein`, `fiber`, `quantity` — only adds/overwrites `categories`, `servings`, `processingLevel`.

Safe to re-run: already-classified meals (without a force-terms match) are skipped.

## Usage

From PowerShell, in the project directory:

```powershell
cd C:\Users\justi\Documents\aiPersonal\FitnessLove   # local folder name (repo is snappyapples/LongevityDiet)
$env:APP_EMAIL = "your-app-login@example.com"
$env:APP_PASSWORD = "your-password"
node scripts/backfill-longevity.mjs
```

**Dependencies:** Reads `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `OPENAI_API_KEY` from the project's `.env.local`. The script resolves `.env.local` relative to its own location (`scripts/` → project root), so it works regardless of where the project folder lives.

## `FORCE_TERMS` — targeted re-classification

Setting `FORCE_TERMS` makes the script re-process meals whose item names contain any of the listed substrings, even if they're already classified. Comma-separated, case-insensitive.

```powershell
$env:APP_EMAIL = "your-app-login@example.com"
$env:APP_PASSWORD = "your-password"
$env:FORCE_TERMS = "chicken,turkey,duck,poultry,meatball"
node scripts/backfill-longevity.mjs
```

Use when:

- You've tightened the prompt and want to fix historical misclassifications without re-processing *everything* (saves OpenAI costs).
- You want to audit a subset of your history after a category definition changes.

Examples:

| Goal | FORCE_TERMS |
|---|---|
| Fix poultry mis-labeled as red meat | `"chicken,turkey,duck,poultry,meatball"` |
| Reclassify drinks after juice rule change | `"juice,soda,smoothie,latte,coffee"` |
| Pick up newly-labeled UPF fried takeout | `"orange chicken,sesame chicken,general tso,nuggets,tempura"` |

## Output

```
Signing in as you@example.com
Authenticated as user 9f0a7395-...

Fetching meals...
Found 120 total meals.
FORCE_TERMS active: [chicken, turkey, duck, poultry, meatball]
18 meals need classification.

  2026-04-15 dinner     (4 items)... ok
  2026-04-12 lunch      (3 items)... ok
  ...

=== Done ===
Updated: 17
Failed:  1
Skipped (already classified): 102
```

Failures are typically caused by:
- The LLM returning a response with a different item count than sent (rare; usually happens with very large meals — retry generally works).
- Rate limits or transient OpenAI errors (retry).

Re-running the same command will retry any meal that still needs classification.

## Cost estimation

Each meal costs roughly one gpt-5-mini chat completion. Costs are low — a full 120-meal re-backfill is a few cents.

## Credentials security

- Use `Read-Host -AsSecureString | ConvertFrom-SecureString -AsPlainText` (PowerShell 7+) to avoid the password appearing on screen.
- Passwords put inline after a leading space may be kept out of shell history depending on your PowerShell profile — verify with `Get-History` before assuming.
- Don't commit `APP_PASSWORD` or related env files.
