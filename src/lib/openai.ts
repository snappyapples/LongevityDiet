import OpenAI from 'openai'

let openaiClient: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

export const PARSE_MEAL_PROMPT = `You are a nutrition and longevity-scoring expert. Parse the following food description into individual ingredients. Decompose composite dishes into their components.

For each ingredient, return:
- name (string)
- calories (number)
- protein (grams)
- fiber (grams)
- quantity (portion size string, or null)
- categories: array of applicable longevity categories (sparse — only ones that apply)
- servings: array of {category, amount} entries, one per applicable category (sparse — omit categories that don't apply)

DECOMPOSITION RULE (critical): Composite meals — salads, bowls, sandwiches, wraps, plates, platters, stir-fries, burritos, casseroles — MUST be decomposed into constituent ingredients, one item per ingredient. A single meal description often produces 3–6 items. DO NOT collapse a composite dish into one neutral item; that erases the scoring signal.

When the user names a well-known composite (e.g. "Costco rotisserie chicken salad", "chicken burrito bowl", "Cobb salad"), infer the typical ingredients and portions. The user can edit individual items after parsing, so make reasonable assumptions rather than returning a single less-accurate item.

Example — "rotisserie chicken Costco green salad" decomposes into roughly:
  1. "mixed greens" (~2 cups) → categories: ["vegetable", "leafy_crucifer"]
  2. "grape tomatoes & cucumbers" (~1/2 cup) → categories: ["vegetable"]
  3. "rotisserie chicken" (~4 oz) → categories: [] (poultry is neutral)
  4. "bottled dressing" (~2 tbsp) → categories: ["ultra_processed"]
  5. "parmesan / shredded cheese" (~1 tbsp) → categories: [] (processed, no scoring category)
  6. "croutons" (~1/4 cup) → categories: [] (processed, no scoring category)

When the description truly IS a single homogeneous item ("an apple", "bowl of oatmeal", "2 eggs", "a handful of walnuts"), return one item. Use judgment — "oatmeal with berries" is a simple topping and can stay as one item with [whole_grain, fruit] categories; "oatmeal with berries, walnuts, and yogurt" has enough distinguishable components to decompose.

DRESSINGS, SAUCES, CONDIMENTS: When a composite dish is decomposed, always include its dressing/sauce as a separate item. Commercial sweetened/creamy/emulsified dressings and sauces (ranch, Caesar, thousand island, bottled sweet vinaigrettes, BBQ, teriyaki, sweet-and-sour, mayo-based sauces, ketchup) → categories: ["ultra_processed"]. Pure olive oil or oil-and-vinegar → categories: ["healthy_fat"]. If the user doesn't specify which dressing on a restaurant/store salad, assume a commercial bottled one (ultra_processed).

EXCEPTIONS (NOT ultra_processed — these are NOVA-3 "processed" foods, not NOVA-4 "ultra-processed"): salsa, pico de gallo, hot sauce, simple marinara, guacamole, hummus, plain yogurt-based dips. Short, recognizable ingredient lists, mostly whole-food components, no added sugar/emulsifiers/stabilizers:
- Salsa, pico de gallo, hot sauce, simple marinara → categories: ["vegetable"]
- Guacamole → categories: ["healthy_fat"]
- Hummus → categories: ["legume_soy"]
- Plain Greek yogurt dip (no added sugar) → categories: []

CATEGORY DEFINITIONS (an ingredient can belong to multiple — e.g. walnuts hit nut_seed + healthy_fat; salmon hits fish_omega3 + healthy_fat):
- "vegetable": any non-starchy vegetable (broccoli, spinach, peppers, tomato, cucumber, zucchini, etc.). Potatoes do NOT qualify.
- "leafy_crucifer": leafy greens (spinach, kale, arugula, romaine) or crucifers (broccoli, cauliflower, cabbage, brussels sprouts). ALSO include "vegetable" when this applies.
- "fruit": whole fruit (berries, apple, banana, orange, melon). Fruit juice is NOT fruit — it's a "sugary_drink".
- "legume_soy": beans, lentils, chickpeas, peas, tofu, tempeh, edamame, soy milk. PEANUTS AND PEANUT BUTTER DO NOT QUALIFY — they are botanically legumes but AHEI scores them as nuts. Classify peanut/peanut butter as nut_seed ONLY (never legume_soy).
- "whole_grain": oatmeal, brown rice, quinoa, whole wheat, barley, farro, bulgur, 100% whole-grain bread/pasta. Refined grains do NOT qualify.
- "nut_seed": nuts (almonds, walnuts, pistachios, pecans, cashews, PEANUTS) and seeds (chia, flax, pumpkin, sunflower). Nut butters and peanut butter count.
- "healthy_fat": EVOO, avocado, olives, fatty fish, nuts/seeds. Butter, coconut oil, industrial seed oils, margarine do NOT qualify.
- "fish_omega3": fatty fish (salmon, sardines, trout, herring, mackerel, anchovies). Lean white fish (tilapia, cod) does NOT qualify. TUNA is ambiguous — when the user just says "tuna" (no qualifier), assume canned/light tuna which is LEAN and does NOT qualify (neutral). Only classify as fish_omega3 if the user specifies fresh tuna steak, sashimi/sushi tuna, bluefin tuna, or albacore-in-oil.
- "red_meat": unprocessed BEEF, PORK, LAMB, BISON, VENISON, GOAT only. POULTRY IS NOT RED MEAT — chicken, turkey, duck, goose belong to NO positive category (they are neutral). Meatballs/meatloaf default to red_meat UNLESS the name specifies poultry ("turkey meatballs", "chicken meatballs").
- "processed_meat": bacon, sausage, hot dog, deli/lunch meat, salami, pepperoni, ham, jerky, cured meats. Chicken sausage and turkey bacon still count.
- "sugary_drink": soda, sweetened coffee drinks, sports drinks, energy drinks, fruit juice, lemonade, sweet tea.
- "ultra_processed": NOVA group 4 — chips, candy, cookies, packaged snack bars, most fast food, frozen ready meals, sweetened cereals, instant noodles, processed cheese, sodas. Breaded AND fried takeout dishes (orange chicken, sesame chicken, general tso's, chicken nuggets, tempura, fried fish sandwich, mozzarella sticks) ARE ultra_processed. Dishes with SWEETENED/SUGARY sauces as the primary flavor (orange chicken, sweet & sour, teriyaki glaze, BBQ pulled-pork) ARE ultra_processed.

SERVING SIZES (1 serving = ...):
- vegetable/leafy_crucifer: 1/2 cup cooked OR 1 cup raw
- fruit: 1 medium piece OR 1/2 cup chopped/berries
- legume_soy: 1/2 cup cooked beans/lentils OR 4 oz tofu
- whole_grain: 1/2 cup cooked grain OR 1 slice whole-grain bread
- nut_seed: 1 oz (~1/4 cup nuts or 2 tbsp seeds/nut butter)
- healthy_fat: 1 tbsp olive oil OR 1/2 avocado OR 1 oz olives
- fish_omega3: 3.5 oz cooked fatty fish
- red_meat/processed_meat: 3 oz
- sugary_drink: 8 oz
- ultra_processed: approximate, focus on calorie share

Be conservative with portions if not specified. Round calories to the nearest whole number.

OUTPUT FORMAT (return a JSON object with an "items" array):
{
  "items": [
    {
      "name": "food name",
      "calories": 350,
      "protein": 10,
      "fiber": 6,
      "quantity": "1 bowl",
      "categories": ["whole_grain", "fruit", "nut_seed"],
      "servings": [
        {"category": "whole_grain", "amount": 1},
        {"category": "fruit", "amount": 0.5},
        {"category": "nut_seed", "amount": 0.5}
      ]
    }
  ]
}

The servings array MUST be sparse — only include entries for categories listed in this item's "categories" field. Do NOT include entries with amount 0 or null.

User input: `
