// Longevity scoring categories (adapted AHEI-2010)
export type FoodCategory =
  | 'vegetable'
  | 'leafy_crucifer'       // counted ALSO as 'vegetable' (bonus subcategory)
  | 'fruit'
  | 'legume_soy'
  | 'whole_grain'
  | 'nut_seed'
  | 'healthy_fat'          // EVOO, avocado, olives, fatty fish, nuts/seeds (fish/nuts double-count intentionally)
  | 'fish_omega3'          // salmon, sardines, trout, herring, mackerel
  | 'red_meat'             // beef, pork, lamb (unprocessed)
  | 'processed_meat'       // bacon, sausage, deli meat, hot dog
  | 'sugary_drink'         // soda, fruit juice, sweetened beverages
  | 'ultra_processed'      // NOVA-4 foods: chips, candy, packaged snacks, fast food, etc.

export type ProcessingLevel = 'whole' | 'minimal' | 'processed' | 'ultra_processed'

export interface FoodItem {
  id: string
  name: string
  calories: number
  protein: number
  fiber: number
  quantity?: string
  // Longevity scoring fields (optional for backwards compat; populated by parser going forward)
  categories?: FoodCategory[]
  servings?: Partial<Record<FoodCategory, number>>
  processingLevel?: ProcessingLevel
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'indulgence'

// Free-form context attached to a meal. Currently just optional notes.
// Legacy meals may have hungerLevel/stressLevel/ateWithOthers fields in their
// jsonb; the type intentionally no longer surfaces them — they're inert.
export interface MealContext {
  notes?: string
}

export interface Meal {
  id: string
  date: string
  type: MealType
  items: FoodItem[]
  totalCalories: number
  totalProtein: number
  totalFiber: number
  context?: MealContext
  createdAt: string
}

export interface DayData {
  date: string
  meals: Meal[]
  totalCalories: number
  totalProtein: number
  totalFiber: number
}

// Longevity scoring types

export interface LongevityComponentScore {
  points: number     // earned points
  max: number        // max possible points
  value: number      // raw measured value (e.g. servings/1000 kcal, or % of kcal)
}

export interface LongevitySubscores {
  plants: LongevityComponentScore        // veg + fruit + legumes + whole grains + nuts (max 50)
  fatQuality: LongevityComponentScore    // healthy fat (max 10)
  proteinQuality: LongevityComponentScore // fish/omega-3 (max 10)
  harmReduction: LongevityComponentScore // sugary drinks + red meat + UPF (max 30)
}

export interface LongevityComponentBreakdown {
  vegetables: LongevityComponentScore
  fruit: LongevityComponentScore
  legumes: LongevityComponentScore
  wholeGrains: LongevityComponentScore
  nutsSeeds: LongevityComponentScore
  healthyFat: LongevityComponentScore
  fish: LongevityComponentScore
  sugaryDrinks: LongevityComponentScore
  redProcessedMeat: LongevityComponentScore
  ultraProcessed: LongevityComponentScore
}

export interface LongevityDailyScore {
  date: string
  totalScore: number  // 0-100
  hasData: boolean    // false if no meals logged that day
  components: LongevityComponentBreakdown
  subscores: LongevitySubscores
}

export interface LongevityReport {
  todayScore: LongevityDailyScore     // today as a single-day score (for day card display)
  rollingScore: number                // 7-day rolling window score (0-100) — primary metric
  rollingHasData: boolean             // true if any items in the rolling window
  dailyScores: LongevityDailyScore[]  // last 7 days, most recent first (for day cards)
  subscoresRolling: LongevitySubscores        // subscores of the current 7-day window
  componentsRolling: LongevityComponentBreakdown  // full component breakdown of current window
  thisWeekAvg: number                 // alias for rollingScore (retained for backcompat)
  lastWeekAvg: number | null          // prior 7-day window score
  weeklyDelta: number | null          // rollingScore - lastWeekAvg
}

// Meal Coach — conversational AI assistant with persistent memory
export interface CoachMemory {
  id: string
  fact: string                  // short atomic preference/constraint, e.g. "Doesn't like tofu"
  source: 'user' | 'ai'         // who originated it ('ai' = AI-proposed, user-confirmed)
  createdAt: string
}

export interface CoachMessage {
  role: 'user' | 'assistant'
  content: string
}

// Structured AI response from /api/coach
export interface CoachResponse {
  reply: string                       // conversational answer (may contain meal ideas)
  suggestedMemories: string[]         // durable facts the AI proposes to remember (user confirms)
}
