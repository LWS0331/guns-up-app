// Food DB v2 helpers — used by Gunny prompt-builder + nutrition surfaces.
//
// Design goal: keep the Gunny system prompt small. The whole 293-entry
// DB is too big to put in every chat turn — instead, the chat layer
// can call these helpers when the user's message hints at a food.
// (1) `searchFoodDb` does fast keyword + bilingual matching.
// (2) `buildFoodContextBlock` formats matches into a compact prompt
// snippet the chat layer interpolates *only when relevant*.
// (3) For the nutrition logging UI, `lookupFoodById` gives the full
// row.
//
// Matching strategy (prioritized):
//   1. Exact id match (e.g. user says "carne asada" → carne_asada_4oz)
//   2. Substring on name_en or name_es
//   3. Token-bag fuzzy match (lowercase + split + intersect)
//
// We don't currently fuzzy-search on chain names ("McDonald's") because
// the chain prefix is part of the name_en string already.

import { FOOD_DB_V2, FOOD_DB_V2_COUNT, type FoodEntry, type NutritionCategory } from '@/data/foods-v2';

export { FOOD_DB_V2, FOOD_DB_V2_COUNT };
export type { FoodEntry, NutritionCategory };

/** Look up an entry by exact id. */
export function lookupFoodById(id: string): FoodEntry | undefined {
  return FOOD_DB_V2.find(f => f.id === id);
}

/** Lowercase token bag for matching. */
function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-záéíóúñ0-9]+/).filter(Boolean);
}

interface SearchOptions {
  language?: 'en' | 'es';
  limit?: number;
  categories?: NutritionCategory[];
}

/**
 * Keyword search over the food DB. Returns matches scored from highest
 * to lowest:
 *   100 = exact id match
 *    50 = name_en/name_es contains the full query string
 *    30 = all query tokens present somewhere in name
 *  10-29 = partial token overlap (proportional)
 */
export function searchFoodDb(query: string, opts: SearchOptions = {}): FoodEntry[] {
  const limit = opts.limit ?? 8;
  const lang = opts.language || 'en';
  const cats = opts.categories;
  const q = query.trim().toLowerCase();
  if (!q) return [];

  type Scored = { entry: FoodEntry; score: number };
  const scored: Scored[] = [];
  const qTokens = tokens(q);

  for (const entry of FOOD_DB_V2) {
    if (cats && !cats.includes(entry.category)) continue;
    const haystacks = lang === 'es' && entry.name_es
      ? [entry.name_en, entry.name_es]
      : [entry.name_en, entry.name_es].filter(Boolean);

    let score = 0;
    if (entry.id === q) score = 100;
    else {
      for (const h of haystacks) {
        const hl = h.toLowerCase();
        if (hl.includes(q)) { score = Math.max(score, 50); continue; }
        const hTokens = tokens(h);
        const matched = qTokens.filter(t => hTokens.includes(t));
        if (matched.length === qTokens.length && qTokens.length > 0) {
          score = Math.max(score, 30);
        } else if (matched.length > 0) {
          score = Math.max(score, 10 + Math.floor((matched.length / qTokens.length) * 19));
        }
      }
    }
    if (score > 0) scored.push({ entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.entry);
}

/**
 * Format an entry into a single-line prompt-friendly summary.
 * Example:
 *   "Chicken breast, grilled — 4 oz / 113g · 187 cal · 35g P · 0g C · 4g F · 84mg Na"
 */
export function formatFoodLine(entry: FoodEntry): string {
  const parts = [
    `${entry.name_en}${entry.name_es ? ` / ${entry.name_es}` : ''}`,
    `${entry.serving_us} / ${entry.serving_metric}`,
    `${entry.calories} cal`,
    `${entry.protein_g}g P`,
    `${entry.carbs_g}g C`,
    `${entry.fat_g}g F`,
  ];
  if (entry.sodium_mg > 50) parts.push(`${entry.sodium_mg}mg Na`);
  if (entry.caffeine_mg > 0) parts.push(`${entry.caffeine_mg}mg caf`);
  if (entry.notes) parts.push(`(${entry.notes})`);
  return parts.join(' · ');
}

/**
 * Build a compact prompt context block listing the top-N matches for
 * a query. Returns "" when no matches — caller can skip injection.
 *
 * Example output:
 *   FOOD DB MATCHES (top 3):
 *   - Carne asada — 4 oz / 112g · 250 cal · 28g P · 1g C · 14g F · 620mg Na (Sodium 500-800mg/4oz depending on marinade.)
 *   - Pollo asado — 4 oz / 112g · 210 cal · 28g P · 1.5g C · 9.5g F · 510mg Na
 *   - Carnitas — 4 oz / 112g · 295 cal · 25g P · 0.5g C · 20g F · 540mg Na (Intentionally fatty (~20g/4oz) — fat is part of the dish.)
 */
export function buildFoodContextBlock(query: string, opts: SearchOptions = {}): string {
  const matches = searchFoodDb(query, { ...opts, limit: opts.limit ?? 5 });
  if (matches.length === 0) return '';
  const header = `FOOD DB MATCHES (top ${matches.length}):`;
  const lines = matches.map(m => `- ${formatFoodLine(m)}`);
  return [header, ...lines].join('\n');
}

/**
 * Try to extract food candidates from a free-text user message and
 * return a context block listing all matches across them. Used by
 * Gunny chat to dynamically pull relevant DB entries when the user
 * mentions food.
 *
 * Strategy: split on commas + " and ", search each chunk, dedupe by
 * id, keep at most `limit` total entries.
 */
export function buildFoodContextFromMessage(message: string, limit = 8, language: 'en' | 'es' = 'en'): string {
  const chunks = message
    .split(/[,;\n]| and | y /i)
    .map(s => s.trim())
    .filter(s => s.length >= 3 && s.length <= 60);
  if (chunks.length === 0) return '';

  const seen = new Set<string>();
  const collected: FoodEntry[] = [];
  for (const chunk of chunks) {
    if (collected.length >= limit) break;
    const matches = searchFoodDb(chunk, { language, limit: 3 });
    for (const m of matches) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      collected.push(m);
      if (collected.length >= limit) break;
    }
  }
  if (collected.length === 0) return '';
  return ['FOOD DB MATCHES (relevant entries from message):', ...collected.map(m => `- ${formatFoodLine(m)}`)].join('\n');
}

/**
 * Get the static system-prompt instruction explaining the food DB
 * lookup contract. This is the SHORT block that goes in every Gunny
 * system prompt — the actual entries are only injected when the
 * user's message hints at food (via buildFoodContextFromMessage).
 */
export const FOOD_DB_SYSTEM_INSTRUCTION = `NUTRITION DATABASE PROTOCOL:
You have access to a curated 293-entry food + supplement database covering whole foods, fast food chains (McDonald's, Chipotle, Subway, Chick-fil-A, In-N-Out, Taco Bell, Starbucks, Panera, Five Guys, Wendy's, Domino's, Jersey Mike's, Buffalo Wild Wings, Olive Garden), restaurant staples, Latino/Mexican dishes (carne asada, carnitas, mole, tamales, chilaquiles, pozole, etc.), supplements (with effective-dose context), condiments, and beverages. Spanish names are populated for the Latino category.

When the user describes a meal:
  1. FIRST attempt id-match against the database (e.g. "Chipotle chicken bowl" → look it up exactly)
  2. THEN component reconstruction (e.g. "two eggs and oatmeal" → 2× egg_whole_large + 1 packet instant_oats)
  3. ONLY fall back to general estimation if no entries match

Database matches will be injected into the conversation as "FOOD DB MATCHES" blocks when relevant. When that block appears, prefer those numbers over your own estimates — they're sourced from USDA + manufacturer labels + ISSN/NIH ODS, not generated.

When user message language is Spanish, prefer Latino-category matches and use the name_es field in your response.

Caffeine: sum across all logged items per day; flag totals >400mg per ISSN/FDA guidance.
Sodium: fast food and Latino dishes can hit 1,000-3,500mg per item — flag high totals for users with hypertension.`;
