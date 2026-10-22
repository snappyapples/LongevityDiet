// One OpenAI model per task, benchmarked with scripts/bench-models.mjs. Each can be overridden by env.
export const PARSE_MEAL_MODEL = process.env.PARSE_MEAL_MODEL || 'gpt-5.6-luna'
export const COACH_MODEL = process.env.COACH_MODEL || 'gpt-5.6-terra'
export const DIGEST_MODEL = process.env.DIGEST_MODEL || 'gpt-5.6-luna'
