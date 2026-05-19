/**
 * Tool registry. Each tool is registered against a fresh per-request
 * McpServer instance with the trainer's GunnyApiClient captured by
 * closure. Stateless per-request keeps multi-tenant trivial (no shared
 * state between RAMPAGE + VALKYRIE calls).
 *
 * Tools cluster:
 *   READ  — get_my_profile, get_today_workout, get_workouts_in_range,
 *           get_my_nutrition_today, get_my_prs, get_my_day_tags
 *   WRITE — log_meal, log_pr, set_day_tag, add_or_update_workout
 *
 * Phase 1 deliberately omits any client-facing tools (no "list my
 * clients", "push plan to client") — that's Phase 2. Everything here
 * acts on the trainer's OWN account.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  DailyReadinessEntry,
  GunnyApiClient,
  MacroTargets,
  Meal,
  PRRecord,
  Workout,
  WorkoutBlock,
} from './api-client.js';
import {
  assertValidDateRange,
  projectNutritionInRange,
  projectProfileSummary,
  projectWorkoutsInRange,
} from './projections.js';

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function jsonContent(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function textContent(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}

const DATE_KEY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export function registerAllTools(server: McpServer, client: GunnyApiClient): void {
  // ──────────────────────── READ TOOLS ────────────────────────

  server.registerTool(
    'get_my_profile',
    {
      title: 'Get my operator profile',
      description:
        'Returns the trainer\'s full operator record: intake, profile, preferences, sitrep, dailyBrief, plus summaries of workouts/nutrition/prs/dayTags. Use this to ground answers in the trainer\'s real data instead of guessing.',
      inputSchema: {},
    },
    async () => {
      const op = await client.getOperator();
      // Trim heavy nested blobs for the default profile view — keep the
      // model's context window from getting buried under months of meal
      // logs every time it asks "who am I?".
      return jsonContent(projectProfileSummary(op));
    }
  );

  server.registerTool(
    'get_today_workout',
    {
      title: 'Get today\'s workout',
      description:
        'Returns the workout planned/completed for today (operator local time). Returns `{date, workout: null}` if nothing is scheduled.',
      inputSchema: {},
    },
    async () => {
      const op = await client.getOperator();
      const date = todayKey();
      const workout = op.workouts?.[date] ?? null;
      return jsonContent({ date, workout });
    }
  );

  server.registerTool(
    'get_workouts_in_range',
    {
      title: 'Get workouts in a date range',
      description:
        'Returns every workout keyed between `from` and `to` (inclusive). Useful for weekly recaps, volume audits, and finding the last time a lift was trained.',
      inputSchema: {
        from: DATE_KEY,
        to: DATE_KEY,
      },
    },
    async ({ from, to }) => {
      const op = await client.getOperator();
      return jsonContent(projectWorkoutsInRange(op, { from, to }));
    }
  );

  server.registerTool(
    'get_my_nutrition_today',
    {
      title: 'Get today\'s nutrition',
      description:
        'Returns today\'s logged meals + macro totals + target gap (target − consumed).',
      inputSchema: {},
    },
    async () => {
      const op = await client.getOperator();
      const date = todayKey();
      const meals = op.nutrition?.meals?.[date] ?? [];
      const totals = meals.reduce(
        (acc, m) => ({
          calories: acc.calories + (m.calories || 0),
          protein: acc.protein + (m.protein || 0),
          carbs: acc.carbs + (m.carbs || 0),
          fat: acc.fat + (m.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      const targets = op.nutrition?.targets;
      const remaining = targets
        ? {
            calories: targets.calories - totals.calories,
            protein: targets.protein - totals.protein,
            carbs: targets.carbs - totals.carbs,
            fat: targets.fat - totals.fat,
          }
        : null;
      return jsonContent({ date, meals, totals, targets, remaining });
    }
  );

  server.registerTool(
    'get_my_prs',
    {
      title: 'Get my PR board',
      description:
        'Returns the full PR list. Optional `exercise` filter narrows to one lift (case-insensitive match on exercise name).',
      inputSchema: {
        exercise: z.string().optional(),
      },
    },
    async ({ exercise }) => {
      const op = await client.getOperator();
      let prs = op.prs || [];
      if (exercise) {
        const needle = exercise.toLowerCase();
        prs = prs.filter((p) => (p.exercise || '').toLowerCase().includes(needle));
      }
      return jsonContent(prs);
    }
  );

  server.registerTool(
    'get_my_day_tags',
    {
      title: 'Get my day tags',
      description:
        'Returns calendar day tags ({color, note} per date) — used for marking rest days, deload weeks, sickness, etc. Optional date-range filter.',
      inputSchema: {
        from: DATE_KEY.optional(),
        to: DATE_KEY.optional(),
      },
    },
    async ({ from, to }) => {
      const op = await client.getOperator();
      const all = op.dayTags || {};
      if (!from && !to) return jsonContent(all);
      const out: typeof all = {};
      for (const [date, tag] of Object.entries(all)) {
        if (from && date < from) continue;
        if (to && date > to) continue;
        out[date] = tag;
      }
      return jsonContent(out);
    }
  );

  // ──────────────────────── WRITE TOOLS ────────────────────────

  server.registerTool(
    'log_meal',
    {
      title: 'Log a meal',
      description:
        'Append a meal to nutrition.meals[date]. All four macros (calories, protein, carbs, fat) are required and must be numeric. Date defaults to today (operator local).',
      inputSchema: {
        name: z.string().min(1),
        calories: z.number().nonnegative(),
        protein: z.number().nonnegative(),
        carbs: z.number().nonnegative(),
        fat: z.number().nonnegative(),
        date: DATE_KEY.optional(),
      },
    },
    async ({ name, calories, protein, carbs, fat, date }) => {
      const op = await client.getOperator();
      const target = date ?? todayKey();
      const meal: Meal = {
        id: `meal-mcp-${Date.now()}`,
        name,
        calories: Math.round(calories),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        time: new Date().toISOString(),
      };
      const existing = op.nutrition || { meals: {} };
      const existingMeals = (existing.meals as Record<string, Meal[]> | undefined) || {};
      const bucket = existingMeals[target] || [];
      const nextNutrition = {
        ...existing,
        meals: { ...existingMeals, [target]: [...bucket, meal] },
      };
      await client.patchProfile({ nutrition: nextNutrition });
      return textContent(
        `Logged: ${meal.name} — ${meal.calories}cal / ${meal.protein}P / ${meal.carbs}C / ${meal.fat}F on ${target}.`
      );
    }
  );

  server.registerTool(
    'log_pr',
    {
      title: 'Log a PR',
      description:
        'Append a personal record to the PR board. `exercise` + `weight` (lbs, no units) are required. `reps` defaults to 1. `date` defaults to today.',
      inputSchema: {
        exercise: z.string().min(1),
        weight: z.number().positive(),
        reps: z.number().int().positive().optional(),
        date: DATE_KEY.optional(),
        notes: z.string().optional(),
        type: z.enum(['strength', 'endurance', 'consistency', 'milestone']).optional(),
      },
    },
    async ({ exercise, weight, reps, date, notes, type }) => {
      const op = await client.getOperator();
      const newPr: PRRecord = {
        id: `pr-mcp-${Date.now()}`,
        exercise: exercise.trim(),
        weight: Math.round(weight),
        reps: reps ?? 1,
        date: date ?? todayKey(),
        notes: notes ?? 'Logged via MCP',
        type: type ?? 'strength',
      };
      const prs = [...(op.prs || []), newPr];
      await client.patchWorkouts({ prs });
      return textContent(
        `PR logged: ${newPr.exercise} ${newPr.weight}lbs × ${newPr.reps} on ${newPr.date}.`
      );
    }
  );

  server.registerTool(
    'set_day_tag',
    {
      title: 'Set a day tag',
      description:
        'Tag a calendar date with a color + note. Colors map to existing planner semantics: cyan = rest, amber = deload, red = injured/sick, green = great session. Pass an empty/missing color to clear the tag.',
      inputSchema: {
        date: DATE_KEY,
        color: z.enum(['green', 'amber', 'red', 'cyan']).optional(),
        note: z.string().optional(),
      },
    },
    async ({ date, color, note }) => {
      const op = await client.getOperator();
      const tags = { ...(op.dayTags || {}) };
      if (!color) {
        delete tags[date];
        // dayTags lives on the /workouts PATCH allowlist, NOT /profile.
        // The profile route rejects with 400 "No profile fields supplied"
        // if we route dayTags through it.
        await client.patchWorkouts({ dayTags: tags });
        return textContent(`Cleared tag for ${date}.`);
      }
      tags[date] = { color, note: note ?? '' };
      await client.patchWorkouts({ dayTags: tags });
      return textContent(`Tagged ${date} ${color}${note ? ` ("${note}")` : ''}.`);
    }
  );

  server.registerTool(
    'add_or_update_workout',
    {
      title: 'Add or update a workout on a specific date',
      description:
        'Write a full workout to workouts[date]. Replaces any existing workout on that date (the in-app planner overwrites on date-key collision by design). Use `get_workouts_in_range` first if you want to merge instead of replace.',
      inputSchema: {
        date: DATE_KEY,
        title: z.string().min(1),
        warmup: z.string().optional(),
        cooldown: z.string().optional(),
        notes: z.string().optional(),
        completed: z.boolean().optional(),
        blocks: z
          .array(
            z.discriminatedUnion('type', [
              z.object({
                type: z.literal('exercise'),
                exerciseName: z.string().min(1),
                prescription: z.string().min(1),
                videoUrl: z.string().url().optional(),
              }),
              z.object({
                type: z.literal('conditioning'),
                format: z.string().min(1),
                description: z.string().min(1),
              }),
            ])
          )
          .min(1),
      },
    },
    async ({ date, title, warmup, cooldown, notes, completed, blocks }) => {
      const op = await client.getOperator();
      const normalizedBlocks: WorkoutBlock[] = blocks.map((b, i) =>
        b.type === 'conditioning'
          ? {
              type: 'conditioning',
              id: `block-mcp-${Date.now()}-${i}`,
              sortOrder: i + 1,
              format: b.format,
              description: b.description,
              isLinkedToNext: false,
            }
          : {
              type: 'exercise',
              id: `block-mcp-${Date.now()}-${i}`,
              sortOrder: i + 1,
              exerciseName: b.exerciseName,
              prescription: b.prescription,
              videoUrl: b.videoUrl ?? '',
              isLinkedToNext: false,
            }
      );
      const newWorkout: Workout = {
        id: `wk-mcp-${Date.now()}-${date}`,
        date,
        title,
        notes: notes ?? '',
        warmup: warmup ?? '',
        blocks: normalizedBlocks,
        cooldown: cooldown ?? '',
        completed: completed ?? false,
      };
      const workouts = { ...(op.workouts || {}), [date]: newWorkout };
      await client.patchWorkouts({ workouts });
      return textContent(
        `Saved "${title}" to ${date} (${normalizedBlocks.length} blocks).`
      );
    }
  );

  // ─────────── EXTENDED READS (Phase 2 — full app coverage) ───────────

  server.registerTool(
    'get_my_nutrition_in_range',
    {
      title: 'Get nutrition history in a date range',
      description:
        'Returns meals + per-day totals for every date between `from` and `to` inclusive. Use for "how did I eat this week?" / "show my last 7 days of macros" / weekly nutrition audits.',
      inputSchema: { from: DATE_KEY, to: DATE_KEY },
    },
    async ({ from, to }) => {
      const op = await client.getOperator();
      return jsonContent(projectNutritionInRange(op, { from, to }));
    }
  );

  server.registerTool(
    'get_my_injuries',
    {
      title: 'Get my injuries',
      description:
        'Returns the trainer\'s injury list (active + resolved). Each entry has name, status, restrictions, notes. Use before programming any lower-body or compound work.',
      inputSchema: {},
    },
    async () => {
      const op = await client.getOperator();
      return jsonContent(op.injuries ?? []);
    }
  );

  server.registerTool(
    'get_my_recent_workouts',
    {
      title: 'Get my N most recent workouts',
      description:
        'Returns the last `limit` workouts by date (default 5, max 30). Useful for "show me my last few sessions" / variation rule enforcement before programming a new lift.',
      inputSchema: {
        limit: z.number().int().positive().max(30).optional(),
      },
    },
    async ({ limit }) => {
      const op = await client.getOperator();
      const all = op.workouts || {};
      const sorted = Object.entries(all).sort((a, b) => b[0].localeCompare(a[0]));
      const sliced = sorted.slice(0, limit ?? 5);
      return jsonContent(Object.fromEntries(sliced));
    }
  );

  server.registerTool(
    'get_my_macrocycles',
    {
      title: 'Get my macrocycles (periodization plans)',
      description:
        'Returns the trainer\'s macrocycle periodization plans. Read-only in Phase 2 — mutation (create/update/delete) deferred until structured-intent endpoint exists.',
      inputSchema: {},
    },
    async () => {
      const op = await client.getOperator();
      return jsonContent((op as { macroCycles?: unknown[] }).macroCycles ?? []);
    }
  );

  // ─────────── PATCH-style UPDATES (partial, merge-with-existing) ───────────

  server.registerTool(
    'update_my_preferences',
    {
      title: 'Update my training preferences',
      description:
        'Patch any subset of the trainer\'s preferences. Only the fields you pass change; others are left intact. CONFIRM the change with the operator before invoking.',
      inputSchema: {
        split: z.string().optional(),
        daysPerWeek: z.number().int().min(2).max(7).optional(),
        sessionDuration: z.number().int().positive().optional(),
        trainingPath: z.string().optional(),
        equipment: z.array(z.string()).optional(),
        weakPoints: z.array(z.string()).optional(),
        avoidMovements: z.array(z.string()).optional(),
        language: z.string().optional(),
      },
    },
    async (patch) => {
      const op = await client.getOperator();
      const existing = (op.preferences as Record<string, unknown>) || {};
      const merged = { ...existing, ...stripUndefined(patch) };
      await client.patchProfile({ preferences: merged });
      const changed = Object.keys(stripUndefined(patch));
      return textContent(`Updated preferences: ${changed.join(', ')}.`);
    }
  );

  server.registerTool(
    'update_my_profile',
    {
      title: 'Update my physical profile',
      description:
        'Patch weight, body fat, sleep, stress, readiness, age, height, training age. Only fields you pass change. CONFIRM before invoking. For weight/bodyFat, expect numeric values (weight in lbs, bodyFat in %).',
      inputSchema: {
        weight: z.number().positive().optional(),
        bodyFat: z.number().min(0).max(60).optional(),
        height: z.string().optional(),
        age: z.number().int().positive().optional(),
        sleep: z.number().min(0).max(24).optional(),
        stress: z.number().min(1).max(10).optional(),
        readiness: z.number().min(1).max(10).optional(),
        trainingAge: z.string().optional(),
      },
    },
    async (patch) => {
      const op = await client.getOperator();
      const existing = (op.profile as Record<string, unknown>) || {};
      const merged = { ...existing, ...stripUndefined(patch) };
      await client.patchProfile({ profile: merged });
      const changed = Object.keys(stripUndefined(patch));
      return textContent(`Updated profile: ${changed.join(', ')}.`);
    }
  );

  server.registerTool(
    'update_my_intake',
    {
      title: 'Update my intake fields',
      description:
        'Patch intake fields — dietary restrictions, supplements, sleep quality, stress, water target, injury notes, etc. Only fields you pass change. CONFIRM before invoking.',
      inputSchema: {
        dietaryRestrictions: z.array(z.string()).optional(),
        supplements: z.array(z.string()).optional(),
        mealsPerDay: z.number().int().min(1).max(8).optional(),
        sleepQuality: z.number().int().min(1).max(10).optional(),
        stressLevel: z.number().int().min(1).max(10).optional(),
        dailyWaterOz: z.number().min(0).optional(),
        injuryNotes: z.string().optional(),
        injuryHistory: z.array(z.string()).optional(),
        primaryGoal: z.string().optional(),
        secondaryGoals: z.array(z.string()).optional(),
        currentDiet: z.string().optional(),
        proteinPriority: z.string().optional(),
        preferredWorkoutTime: z.string().optional(),
        motivationFactors: z.array(z.string()).optional(),
      },
    },
    async (patch) => {
      const op = await client.getOperator();
      const existing = (op.intake as Record<string, unknown>) || {};
      const merged = { ...existing, ...stripUndefined(patch) };
      await client.patchProfile({ intake: merged });
      const changed = Object.keys(stripUndefined(patch));
      return textContent(`Updated intake: ${changed.join(', ')}.`);
    }
  );

  server.registerTool(
    'update_nutrition_targets',
    {
      title: 'Update macro targets',
      description:
        'Patch calorie + macro targets. Pass only the targets you want to change; others stay. CONFIRM before invoking.',
      inputSchema: {
        calories: z.number().int().positive().optional(),
        protein: z.number().int().nonnegative().optional(),
        carbs: z.number().int().nonnegative().optional(),
        fat: z.number().int().nonnegative().optional(),
      },
    },
    async (patch) => {
      const op = await client.getOperator();
      const existing = op.nutrition || {};
      const existingTargets = (existing.targets as unknown as Record<string, unknown>) || {};
      const mergedTargets = { ...existingTargets, ...stripUndefined(patch) };
      // Targets are stored as a JSON column server-side — the api-client
      // MacroTargets type is stricter than the wire allows. Cast through
      // unknown so the partial passes through cleanly.
      const merged = { ...existing, targets: mergedTargets as unknown as MacroTargets };
      await client.patchProfile({ nutrition: merged });
      return textContent(
        `Updated macro targets: ${Object.entries(stripUndefined(patch)).map(([k, v]) => `${k}=${v}`).join(', ')}.`
      );
    }
  );

  server.registerTool(
    'set_my_injuries',
    {
      title: 'Replace my injury list',
      description:
        'REPLACES the entire injuries array. Use to add/remove/update injuries in one shot. Each entry: { name, status?, restrictions?[], notes? }. CONFIRM the full list before invoking — this is destructive (the old list is overwritten).',
      inputSchema: {
        injuries: z
          .array(
            z.object({
              name: z.string().min(1),
              status: z.enum(['active', 'managed', 'resolved']).optional(),
              restrictions: z.array(z.string()).optional(),
              notes: z.string().optional(),
            })
          )
          .max(50),
      },
    },
    async ({ injuries }) => {
      const enriched = injuries.map((inj, i) => ({
        id: `inj-mcp-${Date.now()}-${i}`,
        ...inj,
      }));
      await client.patchWorkouts({ injuries: enriched });
      return textContent(
        `Replaced injuries list (${enriched.length} ${enriched.length === 1 ? 'entry' : 'entries'}).`
      );
    }
  );

  // ─────────── DELETES (with explicit-action naming) ───────────

  server.registerTool(
    'delete_workout',
    {
      title: 'Delete a workout from a specific date',
      description:
        'Removes the workout on `date` from the planner. Cannot be undone via this tool — confirm the date with the operator before invoking.',
      inputSchema: { date: DATE_KEY },
    },
    async ({ date }) => {
      const op = await client.getOperator();
      const all = { ...(op.workouts || {}) };
      if (!all[date]) {
        return textContent(`No workout on ${date} to delete.`);
      }
      const title = (all[date]?.title as string) || 'workout';
      delete all[date];
      await client.patchWorkouts({ workouts: all });
      return textContent(`Deleted "${title}" from ${date}.`);
    }
  );

  server.registerTool(
    'delete_meal',
    {
      title: 'Delete a logged meal',
      description:
        'Removes a single meal from `nutrition.meals[date]` by its id (returned in get_my_nutrition_today / get_my_nutrition_in_range). If you don\'t have the id, get_my_nutrition_today first.',
      inputSchema: { date: DATE_KEY, mealId: z.string().min(1) },
    },
    async ({ date, mealId }) => {
      const op = await client.getOperator();
      const existing = op.nutrition || { meals: {} };
      const existingMeals = (existing.meals as Record<string, Meal[]> | undefined) || {};
      const bucket = existingMeals[date] || [];
      const before = bucket.length;
      const filtered = bucket.filter((m) => m.id !== mealId);
      if (filtered.length === before) {
        return textContent(`No meal with id ${mealId} on ${date}.`);
      }
      const nextMeals = { ...existingMeals, [date]: filtered };
      // Drop the date entirely if no meals remain — keeps the structure clean.
      if (filtered.length === 0) delete nextMeals[date];
      const nextNutrition = { ...existing, meals: nextMeals };
      await client.patchProfile({ nutrition: nextNutrition });
      return textContent(`Removed meal ${mealId} from ${date}.`);
    }
  );

  server.registerTool(
    'delete_pr',
    {
      title: 'Delete a PR from the PR board',
      description:
        'Removes a personal record by id (returned in get_my_prs). Use when a PR was logged in error.',
      inputSchema: { prId: z.string().min(1) },
    },
    async ({ prId }) => {
      const op = await client.getOperator();
      const prs = (op.prs as PRRecord[]) || [];
      const filtered = prs.filter((p) => p.id !== prId);
      if (filtered.length === prs.length) {
        return textContent(`No PR with id ${prId}.`);
      }
      await client.patchWorkouts({ prs: filtered });
      return textContent(`Removed PR ${prId}.`);
    }
  );

  // ─────────── DAILY OPS — hydration / readiness / goals ───────────
  // These previously only worked via the Gunny chat XML-tag handlers
  // (paid Anthropic path). Exposing them via MCP closes the last gap
  // toward "app becomes the ledger; every write happens via Claude.ai".

  server.registerTool(
    'log_hydration',
    {
      title: 'Log water intake',
      description:
        'Adds `oz` to nutrition.hydration[date] (default today). `op:"add"` accumulates onto the running total (default); `op:"set"` replaces it.',
      inputSchema: {
        oz: z.number().positive(),
        op: z.enum(['add', 'set']).optional(),
        date: DATE_KEY.optional(),
      },
    },
    async ({ oz, op, date }) => {
      const operator = await client.getOperator();
      const target = date ?? todayKey();
      const action: 'add' | 'set' = op ?? 'add';
      const existingNutrition = operator.nutrition || {};
      const existingHydration = existingNutrition.hydration || {};
      const prior = Number(existingHydration[target] || 0);
      const newTotal = action === 'set' ? Math.round(oz) : prior + Math.round(oz);
      const merged = {
        ...existingNutrition,
        hydration: { ...existingHydration, [target]: newTotal },
      };
      await client.patchProfile({ nutrition: merged });
      return textContent(
        `Logged ${Math.round(oz)}oz (${action}) on ${target}. Total: ${newTotal}oz.`
      );
    }
  );

  server.registerTool(
    'log_readiness',
    {
      title: 'Log a daily readiness check-in',
      description:
        'Captures the trainer\'s readiness check-in for `date` (default today). All numeric fields optional but at least one signal (readiness/sleep/stress/energy/mood/notes) required. Numeric fields clamped 1-10. Today\'s readiness/sleep/stress also mirror into operator.profile so the readiness engine + daily brief see fresh values without re-reading dailyReadiness.',
      inputSchema: {
        readiness: z.number().min(1).max(10).optional(),
        sleep: z.number().min(1).max(10).optional(),
        stress: z.number().min(1).max(10).optional(),
        energy: z.number().min(1).max(10).optional(),
        mood: z.string().min(1).max(80).optional(),
        notes: z.string().min(1).max(500).optional(),
        date: DATE_KEY.optional(),
      },
    },
    async ({ readiness, sleep, stress, energy, mood, notes, date }) => {
      const target = date ?? todayKey();
      const today = todayKey();

      const entry: DailyReadinessEntry = {
        date: target,
        recordedAt: new Date().toISOString(),
      };
      if (readiness !== undefined) entry.readiness = Math.round(readiness);
      if (sleep !== undefined) entry.sleep = Math.round(sleep);
      if (stress !== undefined) entry.stress = Math.round(stress);
      if (energy !== undefined) entry.energy = Math.round(energy);
      if (mood) entry.mood = mood.trim().slice(0, 80);
      if (notes) entry.notes = notes.trim().slice(0, 500);

      const hasContent =
        entry.readiness !== undefined ||
        entry.sleep !== undefined ||
        entry.stress !== undefined ||
        entry.energy !== undefined ||
        entry.mood !== undefined ||
        entry.notes !== undefined;
      if (!hasContent) {
        return textContent(
          'Readiness entry skipped: at least one of readiness / sleep / stress / energy / mood / notes is required.'
        );
      }

      const operator = await client.getOperator();
      const existingReadiness = operator.dailyReadiness || {};
      const mergedReadiness = { ...existingReadiness, [target]: entry };

      // Mirror today's numerics into profile so the readiness engine +
      // daily brief see them without a separate read. Past-date entries
      // skip the mirror — matches applyReadinessEntry in the Gunny route.
      const patch: {
        dailyReadiness: typeof mergedReadiness;
        profile?: Record<string, unknown>;
      } = { dailyReadiness: mergedReadiness };
      if (target === today) {
        const existingProfile = (operator.profile as Record<string, unknown>) || {};
        const mirror = { ...existingProfile };
        if (entry.readiness !== undefined) mirror.readiness = entry.readiness;
        if (entry.sleep !== undefined) mirror.sleep = entry.sleep;
        if (entry.stress !== undefined) mirror.stress = entry.stress;
        patch.profile = mirror;
      }
      await client.patchProfile(patch);

      const captured = Object.keys(entry).filter(
        (k) => k !== 'date' && k !== 'recordedAt'
      );
      return textContent(
        `Logged readiness check-in for ${target} (${captured.join(', ')}).`
      );
    }
  );

  server.registerTool(
    'update_my_goals',
    {
      title: 'Add / remove / replace training goals',
      description:
        'Mutates operator.profile.goals. Pass any combination of `add` (new goal strings), `remove` (substrings to filter out, case-insensitive), `replace` (match → value pairs, first match wins). Goal strings are short freeform text — e.g. "Hit 405 squat by Q3", "Drop to 12% body fat", "Sub-6:00 mile".',
      inputSchema: {
        add: z.array(z.string().min(1)).optional(),
        remove: z.array(z.string().min(1)).optional(),
        replace: z
          .array(
            z.object({
              match: z.string().min(1),
              value: z.string().min(1),
            })
          )
          .optional(),
      },
    },
    async ({ add, remove, replace }) => {
      const operator = await client.getOperator();
      const existingProfile = (operator.profile as Record<string, unknown>) || {};
      let goals = Array.isArray(existingProfile.goals)
        ? [...(existingProfile.goals as string[])]
        : [];
      const summary: string[] = [];

      for (const v of add || []) {
        const trimmed = v.trim();
        if (!trimmed) continue;
        if (goals.some((g) => g.toLowerCase().trim() === trimmed.toLowerCase())) continue;
        goals.push(trimmed);
        summary.push(`+${trimmed}`);
      }
      for (const m of remove || []) {
        const needle = m.toLowerCase().trim();
        if (!needle) continue;
        const before = goals.length;
        goals = goals.filter((g) => !g.toLowerCase().includes(needle));
        if (goals.length !== before) summary.push(`−${m}`);
      }
      for (const r of replace || []) {
        const needle = r.match.toLowerCase().trim();
        const next = r.value.trim();
        if (!needle || !next) continue;
        const idx = goals.findIndex((g) => g.toLowerCase().includes(needle));
        if (idx < 0) continue;
        goals[idx] = next;
        summary.push(`~${r.match}→${next}`);
      }

      if (summary.length === 0) {
        return textContent('No goal changes applied (nothing matched / nothing new).');
      }

      const mergedProfile = { ...existingProfile, goals };
      await client.patchProfile({ profile: mergedProfile });
      return textContent(`Updated goals: ${summary.join(', ')}. Now ${goals.length} total.`);
    }
  );

  server.registerTool(
    'get_my_goals',
    {
      title: 'Get my training goals',
      description:
        'Returns the current goal list (operator.profile.goals). Read-only — use update_my_goals to mutate.',
      inputSchema: {},
    },
    async () => {
      const op = await client.getOperator();
      const goals = ((op.profile as { goals?: string[] } | undefined)?.goals) || [];
      return jsonContent({ goals });
    }
  );

  server.registerTool(
    'get_my_hydration_in_range',
    {
      title: 'Get hydration history',
      description:
        'Returns daily hydration totals (oz) between `from` and `to` inclusive. Compares against intake.dailyWaterOz if set.',
      inputSchema: { from: DATE_KEY, to: DATE_KEY },
    },
    async ({ from, to }) => {
      assertValidDateRange({ from, to });
      const op = await client.getOperator();
      const all = op.nutrition?.hydration || {};
      const targetOz = (op.intake as { dailyWaterOz?: number } | undefined)?.dailyWaterOz;
      const days: Array<{ date: string; oz: number; targetOz?: number }> = [];
      for (const [date, oz] of Object.entries(all)) {
        if (date < from || date > to) continue;
        days.push({ date, oz: Number(oz) || 0, ...(targetOz ? { targetOz } : {}) });
      }
      days.sort((a, b) => a.date.localeCompare(b.date));
      return jsonContent({ from, to, targetOz, days });
    }
  );

  server.registerTool(
    'get_my_readiness_in_range',
    {
      title: 'Get readiness check-in history',
      description:
        'Returns daily readiness entries between `from` and `to` inclusive. Each entry has readiness/sleep/stress/energy/mood/notes as logged.',
      inputSchema: { from: DATE_KEY, to: DATE_KEY },
    },
    async ({ from, to }) => {
      assertValidDateRange({ from, to });
      const op = await client.getOperator();
      const all = op.dailyReadiness || {};
      const days: DailyReadinessEntry[] = [];
      for (const [date, entry] of Object.entries(all)) {
        if (date < from || date > to) continue;
        days.push(entry as DailyReadinessEntry);
      }
      days.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      return jsonContent({ from, to, days });
    }
  );

  // ─────────── CLIENT ROSTER (Phase 3a — reads only) ───────────
  // Trainers (RAMPAGE, VALKYRIE) get full read access to operators
  // where operator.trainerId === their own id. The server enforces
  // trainer-of-target access in GET /api/operators/[id]; if the
  // trainer requests a non-client operator, the server returns 403.
  // Writes for clients are Phase 3b — they need extra confirmation
  // affordances so the trainer can't accidentally clobber a client's
  // data with self-targeted intent.
  //
  // Workflow: call list_my_clients first to find the client_id, then
  // use it on every subsequent client_* tool call.

  server.registerTool(
    'list_my_clients',
    {
      title: 'List my assigned clients',
      description:
        'Returns the trainer\'s client roster — every operator whose `trainerId` is the calling trainer. Each entry: { id, callsign, name, lastWorkoutDate, workoutCount, prCount, injuryCount }. Use this BEFORE any other client_* tool so you can resolve a callsign (e.g. "EFRAIN") to an operator id (e.g. "op-efrain").',
      inputSchema: {},
    },
    async () => {
      const myOperatorId = clientOperatorId(client);
      const all = await client.listVisibleOperators();
      const roster = all
        .filter((op) => {
          // Server returns self + clients + other trainers. Filter to
          // clients (trainerId === me) and exclude self.
          if (op.id === myOperatorId) return false;
          return (op as { trainerId?: string }).trainerId === myOperatorId;
        })
        .map((op) => {
          const workoutDates = Object.keys(op.workouts || {}).sort();
          const lastWorkoutDate = workoutDates[workoutDates.length - 1] || null;
          return {
            id: op.id,
            callsign: op.callsign ?? null,
            name: op.name ?? null,
            lastWorkoutDate,
            workoutCount: workoutDates.length,
            prCount: (op.prs || []).length,
            injuryCount: (op.injuries || []).length,
          };
        });
      // Sort by lastWorkoutDate desc so most-active clients surface first.
      roster.sort((a, b) =>
        (b.lastWorkoutDate || '').localeCompare(a.lastWorkoutDate || '')
      );
      return jsonContent(roster);
    }
  );

  server.registerTool(
    'get_client_profile',
    {
      title: 'Get a client\'s operator profile',
      description:
        'Returns the same summary shape as get_my_profile, but for the named client. `client_id` from list_my_clients. Server 403s if the client is not assigned to the calling trainer.',
      inputSchema: { client_id: z.string().min(1) },
    },
    async ({ client_id }) => {
      const op = await client.getOperatorById(client_id);
      return jsonContent(projectProfileSummary(op));
    }
  );

  server.registerTool(
    'get_client_today_workout',
    {
      title: 'Get a client\'s today workout',
      description:
        'Returns `{date, workout|null}` for the client\'s today (operator\'s local timezone resolution happens on the server; client may be in a different TZ than the trainer).',
      inputSchema: { client_id: z.string().min(1) },
    },
    async ({ client_id }) => {
      const op = await client.getOperatorById(client_id);
      const date = todayKey();
      const workout = op.workouts?.[date] ?? null;
      return jsonContent({ client_id, date, workout });
    }
  );

  server.registerTool(
    'get_client_workouts_in_range',
    {
      title: 'Get a client\'s workouts in a range',
      description:
        'Returns every workout for the client keyed between `from` and `to` inclusive. Useful for client weekly recaps, volume audits, and "what did EFRAIN do last week?"',
      inputSchema: {
        client_id: z.string().min(1),
        from: DATE_KEY,
        to: DATE_KEY,
      },
    },
    async ({ client_id, from, to }) => {
      assertValidDateRange({ from, to });
      const op = await client.getOperatorById(client_id);
      return jsonContent({
        client_id,
        ...projectWorkoutsInRange(op, { from, to }),
      });
    }
  );

  server.registerTool(
    'get_client_recent_workouts',
    {
      title: 'Get a client\'s N most recent workouts',
      description:
        'Last `limit` workouts (default 5, max 30) for the client, ordered most-recent-first. Use for variation-rule enforcement before programming a new client session.',
      inputSchema: {
        client_id: z.string().min(1),
        limit: z.number().int().positive().max(30).optional(),
      },
    },
    async ({ client_id, limit }) => {
      const op = await client.getOperatorById(client_id);
      const all = op.workouts || {};
      const sorted = Object.entries(all).sort((a, b) => b[0].localeCompare(a[0]));
      const sliced = sorted.slice(0, limit ?? 5);
      return jsonContent({ client_id, workouts: Object.fromEntries(sliced) });
    }
  );

  server.registerTool(
    'get_client_nutrition_today',
    {
      title: 'Get a client\'s today nutrition',
      description:
        'Today\'s meals + macro totals + target gap for the client (operator\'s local date).',
      inputSchema: { client_id: z.string().min(1) },
    },
    async ({ client_id }) => {
      const op = await client.getOperatorById(client_id);
      const date = todayKey();
      const meals = op.nutrition?.meals?.[date] ?? [];
      const totals = meals.reduce(
        (acc, m) => ({
          calories: acc.calories + (m.calories || 0),
          protein: acc.protein + (m.protein || 0),
          carbs: acc.carbs + (m.carbs || 0),
          fat: acc.fat + (m.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      const targets = op.nutrition?.targets;
      const remaining = targets
        ? {
            calories: targets.calories - totals.calories,
            protein: targets.protein - totals.protein,
            carbs: targets.carbs - totals.carbs,
            fat: targets.fat - totals.fat,
          }
        : null;
      return jsonContent({ client_id, date, meals, totals, targets, remaining });
    }
  );

  server.registerTool(
    'get_client_nutrition_in_range',
    {
      title: 'Get a client\'s nutrition history',
      description:
        'Meals + per-day totals for the client between `from` and `to` inclusive.',
      inputSchema: {
        client_id: z.string().min(1),
        from: DATE_KEY,
        to: DATE_KEY,
      },
    },
    async ({ client_id, from, to }) => {
      assertValidDateRange({ from, to });
      const op = await client.getOperatorById(client_id);
      return jsonContent({
        client_id,
        ...projectNutritionInRange(op, { from, to }),
      });
    }
  );

  server.registerTool(
    'get_client_prs',
    {
      title: 'Get a client\'s PR board',
      description:
        'Returns the client\'s PR board. Optional `exercise` filter (case-insensitive substring).',
      inputSchema: {
        client_id: z.string().min(1),
        exercise: z.string().optional(),
      },
    },
    async ({ client_id, exercise }) => {
      const op = await client.getOperatorById(client_id);
      let prs = op.prs || [];
      if (exercise) {
        const needle = exercise.toLowerCase();
        prs = prs.filter((p) => (p.exercise || '').toLowerCase().includes(needle));
      }
      return jsonContent({ client_id, prs });
    }
  );

  server.registerTool(
    'get_client_injuries',
    {
      title: 'Get a client\'s injuries',
      description:
        'Returns the client\'s injury list (active + resolved). CHECK THIS before programming any session for a client — server-side guards prevent unsafe writes but the upfront read keeps the recommendation safe too.',
      inputSchema: { client_id: z.string().min(1) },
    },
    async ({ client_id }) => {
      const op = await client.getOperatorById(client_id);
      return jsonContent({ client_id, injuries: op.injuries ?? [] });
    }
  );

  server.registerTool(
    'get_client_goals',
    {
      title: 'Get a client\'s training goals',
      description:
        'Returns the client\'s goal list (operator.profile.goals). Use this to align programming with the client\'s stated objectives.',
      inputSchema: { client_id: z.string().min(1) },
    },
    async ({ client_id }) => {
      const op = await client.getOperatorById(client_id);
      const goals = ((op.profile as { goals?: string[] } | undefined)?.goals) || [];
      return jsonContent({ client_id, goals });
    }
  );

  // ─────────── CLIENT ROSTER (Phase 3b — writes) ───────────
  // Every tool below mutates an arbitrary client's record. Server-side
  // PATCH /api/operators/[id]/{profile,workouts} routes already enforce
  // trainer-of-target via TRAINER_FIELDS — writes to non-clients 403.
  // Phase 3a (reads) is the safe surface; THESE require disciplined
  // operator confirmation per the persona. Each tool description
  // explicitly tells Gunny to echo the callsign + intent before invoking.

  server.registerTool(
    'log_client_meal',
    {
      title: 'Log a meal for a client',
      description:
        'Append a meal to a client\'s nutrition.meals[date]. CONFIRM the client\'s callsign + macros with the trainer ("logging X for EFRAIN, go?") before invoking.',
      inputSchema: {
        client_id: z.string().min(1),
        name: z.string().min(1),
        calories: z.number().nonnegative(),
        protein: z.number().nonnegative(),
        carbs: z.number().nonnegative(),
        fat: z.number().nonnegative(),
        date: DATE_KEY.optional(),
      },
    },
    async ({ client_id, name, calories, protein, carbs, fat, date }) => {
      const op = await client.getOperatorById(client_id);
      const target = date ?? todayKey();
      const meal: Meal = {
        id: `meal-mcp-${Date.now()}`,
        name,
        calories: Math.round(calories),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
        time: new Date().toISOString(),
      };
      const existing = op.nutrition || { meals: {} };
      const existingMeals = (existing.meals as Record<string, Meal[]> | undefined) || {};
      const bucket = existingMeals[target] || [];
      const nextNutrition = {
        ...existing,
        meals: { ...existingMeals, [target]: [...bucket, meal] },
      };
      await client.patchProfileById(client_id, { nutrition: nextNutrition });
      return textContent(
        `Logged for ${client_id}: ${meal.name} — ${meal.calories}cal / ${meal.protein}P / ${meal.carbs}C / ${meal.fat}F on ${target}.`
      );
    }
  );

  server.registerTool(
    'log_client_pr',
    {
      title: 'Log a PR for a client',
      description:
        'Append a personal record to a client\'s PR board. CONFIRM with the trainer first. Don\'t volunteer — only log when the trainer says the client explicitly hit a PR.',
      inputSchema: {
        client_id: z.string().min(1),
        exercise: z.string().min(1),
        weight: z.number().positive(),
        reps: z.number().int().positive().optional(),
        date: DATE_KEY.optional(),
        notes: z.string().optional(),
        type: z.enum(['strength', 'endurance', 'consistency', 'milestone']).optional(),
      },
    },
    async ({ client_id, exercise, weight, reps, date, notes, type }) => {
      const op = await client.getOperatorById(client_id);
      const newPr: PRRecord = {
        id: `pr-mcp-${Date.now()}`,
        exercise: exercise.trim(),
        weight: Math.round(weight),
        reps: reps ?? 1,
        date: date ?? todayKey(),
        notes: notes ?? `Logged via MCP by trainer`,
        type: type ?? 'strength',
      };
      const prs = [...(op.prs || []), newPr];
      await client.patchWorkoutsById(client_id, { prs });
      return textContent(
        `Logged PR for ${client_id}: ${newPr.exercise} ${newPr.weight}lbs × ${newPr.reps} on ${newPr.date}.`
      );
    }
  );

  server.registerTool(
    'log_client_hydration',
    {
      title: 'Log a client\'s water intake',
      description:
        'Adds `oz` to a client\'s nutrition.hydration[date] (default today). `op:"add"` accumulates (default); `op:"set"` replaces. CONFIRM client callsign.',
      inputSchema: {
        client_id: z.string().min(1),
        oz: z.number().positive(),
        op: z.enum(['add', 'set']).optional(),
        date: DATE_KEY.optional(),
      },
    },
    async ({ client_id, oz, op, date }) => {
      const operator = await client.getOperatorById(client_id);
      const target = date ?? todayKey();
      const action: 'add' | 'set' = op ?? 'add';
      const existingNutrition = operator.nutrition || {};
      const existingHydration = existingNutrition.hydration || {};
      const prior = Number(existingHydration[target] || 0);
      const newTotal = action === 'set' ? Math.round(oz) : prior + Math.round(oz);
      const merged = {
        ...existingNutrition,
        hydration: { ...existingHydration, [target]: newTotal },
      };
      await client.patchProfileById(client_id, { nutrition: merged });
      return textContent(
        `Logged ${Math.round(oz)}oz (${action}) for ${client_id} on ${target}. Total: ${newTotal}oz.`
      );
    }
  );

  server.registerTool(
    'log_client_readiness',
    {
      title: 'Log a readiness check-in for a client',
      description:
        'Captures readiness for the client on `date` (default today). At least one signal required. Numerics clamped 1-10. Mirrors today\'s numerics into the client\'s profile (same as the self path).',
      inputSchema: {
        client_id: z.string().min(1),
        readiness: z.number().min(1).max(10).optional(),
        sleep: z.number().min(1).max(10).optional(),
        stress: z.number().min(1).max(10).optional(),
        energy: z.number().min(1).max(10).optional(),
        mood: z.string().min(1).max(80).optional(),
        notes: z.string().min(1).max(500).optional(),
        date: DATE_KEY.optional(),
      },
    },
    async ({ client_id, readiness, sleep, stress, energy, mood, notes, date }) => {
      const target = date ?? todayKey();
      const today = todayKey();
      const entry: DailyReadinessEntry = {
        date: target,
        recordedAt: new Date().toISOString(),
      };
      if (readiness !== undefined) entry.readiness = Math.round(readiness);
      if (sleep !== undefined) entry.sleep = Math.round(sleep);
      if (stress !== undefined) entry.stress = Math.round(stress);
      if (energy !== undefined) entry.energy = Math.round(energy);
      if (mood) entry.mood = mood.trim().slice(0, 80);
      if (notes) entry.notes = notes.trim().slice(0, 500);

      const hasContent =
        entry.readiness !== undefined || entry.sleep !== undefined ||
        entry.stress !== undefined || entry.energy !== undefined ||
        entry.mood !== undefined || entry.notes !== undefined;
      if (!hasContent) {
        return textContent('Readiness entry skipped: at least one signal required.');
      }

      const operator = await client.getOperatorById(client_id);
      const existingReadiness = operator.dailyReadiness || {};
      const mergedReadiness = { ...existingReadiness, [target]: entry };
      const patch: { dailyReadiness: typeof mergedReadiness; profile?: Record<string, unknown> } = {
        dailyReadiness: mergedReadiness,
      };
      if (target === today) {
        const existingProfile = (operator.profile as Record<string, unknown>) || {};
        const mirror = { ...existingProfile };
        if (entry.readiness !== undefined) mirror.readiness = entry.readiness;
        if (entry.sleep !== undefined) mirror.sleep = entry.sleep;
        if (entry.stress !== undefined) mirror.stress = entry.stress;
        patch.profile = mirror;
      }
      await client.patchProfileById(client_id, patch);
      const captured = Object.keys(entry).filter((k) => k !== 'date' && k !== 'recordedAt');
      return textContent(`Logged readiness for ${client_id} on ${target} (${captured.join(', ')}).`);
    }
  );

  server.registerTool(
    'set_client_day_tag',
    {
      title: 'Tag a client\'s calendar day',
      description:
        'Tag a date on the client\'s calendar with a color + note. green=great session, amber=deload, red=injured/sick, cyan=rest. Pass no color to clear. CONFIRM client + date with the trainer before invoking.',
      inputSchema: {
        client_id: z.string().min(1),
        date: DATE_KEY,
        color: z.enum(['green', 'amber', 'red', 'cyan']).optional(),
        note: z.string().optional(),
      },
    },
    async ({ client_id, date, color, note }) => {
      const op = await client.getOperatorById(client_id);
      const tags = { ...(op.dayTags || {}) };
      if (!color) {
        delete tags[date];
        await client.patchWorkoutsById(client_id, { dayTags: tags });
        return textContent(`Cleared tag for ${client_id} on ${date}.`);
      }
      tags[date] = { color, note: note ?? '' };
      await client.patchWorkoutsById(client_id, { dayTags: tags });
      return textContent(`Tagged ${client_id} ${date} ${color}${note ? ` ("${note}")` : ''}.`);
    }
  );

  server.registerTool(
    'update_client_profile',
    {
      title: 'Update a client\'s physical profile',
      description:
        'Patch weight / bodyFat / sleep / stress / readiness / age / height / trainingAge on a client. Partial — only fields you pass change. CONFIRM client + the specific changes with the trainer before invoking.',
      inputSchema: {
        client_id: z.string().min(1),
        weight: z.number().positive().optional(),
        bodyFat: z.number().min(0).max(60).optional(),
        height: z.string().optional(),
        age: z.number().int().positive().optional(),
        sleep: z.number().min(0).max(24).optional(),
        stress: z.number().min(1).max(10).optional(),
        readiness: z.number().min(1).max(10).optional(),
        trainingAge: z.string().optional(),
      },
    },
    async ({ client_id, ...patch }) => {
      const op = await client.getOperatorById(client_id);
      const existing = (op.profile as Record<string, unknown>) || {};
      const merged = { ...existing, ...stripUndefined(patch) };
      await client.patchProfileById(client_id, { profile: merged });
      const changed = Object.keys(stripUndefined(patch));
      return textContent(`Updated ${client_id} profile: ${changed.join(', ')}.`);
    }
  );

  server.registerTool(
    'update_client_intake',
    {
      title: 'Update a client\'s intake fields',
      description:
        'Patch a client\'s intake — dietary restrictions, supplements, mealsPerDay, sleepQuality, stressLevel, dailyWaterOz, injuryNotes, primaryGoal, etc. CONFIRM with trainer.',
      inputSchema: {
        client_id: z.string().min(1),
        dietaryRestrictions: z.array(z.string()).optional(),
        supplements: z.array(z.string()).optional(),
        mealsPerDay: z.number().int().min(1).max(8).optional(),
        sleepQuality: z.number().int().min(1).max(10).optional(),
        stressLevel: z.number().int().min(1).max(10).optional(),
        dailyWaterOz: z.number().min(0).optional(),
        injuryNotes: z.string().optional(),
        injuryHistory: z.array(z.string()).optional(),
        primaryGoal: z.string().optional(),
        secondaryGoals: z.array(z.string()).optional(),
        currentDiet: z.string().optional(),
        proteinPriority: z.string().optional(),
        preferredWorkoutTime: z.string().optional(),
        motivationFactors: z.array(z.string()).optional(),
      },
    },
    async ({ client_id, ...patch }) => {
      const op = await client.getOperatorById(client_id);
      const existing = (op.intake as Record<string, unknown>) || {};
      const merged = { ...existing, ...stripUndefined(patch) };
      await client.patchProfileById(client_id, { intake: merged });
      const changed = Object.keys(stripUndefined(patch));
      return textContent(`Updated ${client_id} intake: ${changed.join(', ')}.`);
    }
  );

  server.registerTool(
    'update_client_preferences',
    {
      title: 'Update a client\'s training preferences',
      description:
        'Patch a client\'s split, daysPerWeek, sessionDuration, trainingPath, equipment, weakPoints, avoidMovements, language. Partial. CONFIRM with trainer.',
      inputSchema: {
        client_id: z.string().min(1),
        split: z.string().optional(),
        daysPerWeek: z.number().int().min(2).max(7).optional(),
        sessionDuration: z.number().int().positive().optional(),
        trainingPath: z.string().optional(),
        equipment: z.array(z.string()).optional(),
        weakPoints: z.array(z.string()).optional(),
        avoidMovements: z.array(z.string()).optional(),
        language: z.string().optional(),
      },
    },
    async ({ client_id, ...patch }) => {
      const op = await client.getOperatorById(client_id);
      const existing = (op.preferences as Record<string, unknown>) || {};
      const merged = { ...existing, ...stripUndefined(patch) };
      await client.patchProfileById(client_id, { preferences: merged });
      const changed = Object.keys(stripUndefined(patch));
      return textContent(`Updated ${client_id} preferences: ${changed.join(', ')}.`);
    }
  );

  server.registerTool(
    'update_client_nutrition_targets',
    {
      title: 'Update a client\'s macro targets',
      description:
        'Patch a client\'s calorie + macro targets. Partial. CONFIRM with trainer.',
      inputSchema: {
        client_id: z.string().min(1),
        calories: z.number().int().positive().optional(),
        protein: z.number().int().nonnegative().optional(),
        carbs: z.number().int().nonnegative().optional(),
        fat: z.number().int().nonnegative().optional(),
      },
    },
    async ({ client_id, ...patch }) => {
      const op = await client.getOperatorById(client_id);
      const existing = op.nutrition || {};
      const existingTargets = (existing.targets as unknown as Record<string, unknown>) || {};
      const mergedTargets = { ...existingTargets, ...stripUndefined(patch) };
      const merged = { ...existing, targets: mergedTargets as unknown as MacroTargets };
      await client.patchProfileById(client_id, { nutrition: merged });
      return textContent(
        `Updated ${client_id} macro targets: ${Object.entries(stripUndefined(patch)).map(([k, v]) => `${k}=${v}`).join(', ')}.`
      );
    }
  );

  server.registerTool(
    'update_client_goals',
    {
      title: 'Add / remove / replace a client\'s training goals',
      description:
        'Mutates client.profile.goals. Pass add (new strings), remove (substrings, case-insensitive), replace (match → value). CONFIRM with trainer.',
      inputSchema: {
        client_id: z.string().min(1),
        add: z.array(z.string().min(1)).optional(),
        remove: z.array(z.string().min(1)).optional(),
        replace: z
          .array(z.object({ match: z.string().min(1), value: z.string().min(1) }))
          .optional(),
      },
    },
    async ({ client_id, add, remove, replace }) => {
      const op = await client.getOperatorById(client_id);
      const existingProfile = (op.profile as Record<string, unknown>) || {};
      let goals = Array.isArray(existingProfile.goals)
        ? [...(existingProfile.goals as string[])]
        : [];
      const summary: string[] = [];

      for (const v of add || []) {
        const trimmed = v.trim();
        if (!trimmed) continue;
        if (goals.some((g) => g.toLowerCase().trim() === trimmed.toLowerCase())) continue;
        goals.push(trimmed);
        summary.push(`+${trimmed}`);
      }
      for (const m of remove || []) {
        const needle = m.toLowerCase().trim();
        if (!needle) continue;
        const before = goals.length;
        goals = goals.filter((g) => !g.toLowerCase().includes(needle));
        if (goals.length !== before) summary.push(`−${m}`);
      }
      for (const r of replace || []) {
        const needle = r.match.toLowerCase().trim();
        const next = r.value.trim();
        if (!needle || !next) continue;
        const idx = goals.findIndex((g) => g.toLowerCase().includes(needle));
        if (idx < 0) continue;
        goals[idx] = next;
        summary.push(`~${r.match}→${next}`);
      }

      if (summary.length === 0) {
        return textContent(`No goal changes applied to ${client_id}.`);
      }
      const mergedProfile = { ...existingProfile, goals };
      await client.patchProfileById(client_id, { profile: mergedProfile });
      return textContent(`Updated ${client_id} goals: ${summary.join(', ')}. Now ${goals.length} total.`);
    }
  );

  server.registerTool(
    'set_client_injuries',
    {
      title: 'Replace a client\'s injury list',
      description:
        'REPLACES the entire injuries array for a client. CONFIRM the full list with the trainer — this is destructive (old list overwritten).',
      inputSchema: {
        client_id: z.string().min(1),
        injuries: z
          .array(
            z.object({
              name: z.string().min(1),
              status: z.enum(['active', 'managed', 'resolved']).optional(),
              restrictions: z.array(z.string()).optional(),
              notes: z.string().optional(),
            })
          )
          .max(50),
      },
    },
    async ({ client_id, injuries }) => {
      const enriched = injuries.map((inj, i) => ({
        id: `inj-mcp-${Date.now()}-${i}`,
        ...inj,
      }));
      await client.patchWorkoutsById(client_id, { injuries: enriched });
      return textContent(
        `Replaced ${client_id} injuries (${enriched.length} ${enriched.length === 1 ? 'entry' : 'entries'}).`
      );
    }
  );

  server.registerTool(
    'add_or_update_client_workout',
    {
      title: 'Add or update a workout on a client\'s planner',
      description:
        'Writes a full workout to a client\'s workouts[date]. OVERWRITES any existing workout on that date — call get_client_workouts_in_range first if you need to confirm what\'s being replaced. CONFIRM client + date + block summary with the trainer before invoking.',
      inputSchema: {
        client_id: z.string().min(1),
        date: DATE_KEY,
        title: z.string().min(1),
        warmup: z.string().optional(),
        cooldown: z.string().optional(),
        notes: z.string().optional(),
        completed: z.boolean().optional(),
        blocks: z
          .array(
            z.discriminatedUnion('type', [
              z.object({
                type: z.literal('exercise'),
                exerciseName: z.string().min(1),
                prescription: z.string().min(1),
                videoUrl: z.string().url().optional(),
              }),
              z.object({
                type: z.literal('conditioning'),
                format: z.string().min(1),
                description: z.string().min(1),
              }),
            ])
          )
          .min(1),
      },
    },
    async ({ client_id, date, title, warmup, cooldown, notes, completed, blocks }) => {
      const op = await client.getOperatorById(client_id);
      const normalizedBlocks: WorkoutBlock[] = blocks.map((b, i) =>
        b.type === 'conditioning'
          ? {
              type: 'conditioning',
              id: `block-mcp-${Date.now()}-${i}`,
              sortOrder: i + 1,
              format: b.format,
              description: b.description,
              isLinkedToNext: false,
            }
          : {
              type: 'exercise',
              id: `block-mcp-${Date.now()}-${i}`,
              sortOrder: i + 1,
              exerciseName: b.exerciseName,
              prescription: b.prescription,
              videoUrl: b.videoUrl ?? '',
              isLinkedToNext: false,
            }
      );
      const newWorkout: Workout = {
        id: `wk-mcp-${Date.now()}-${date}`,
        date,
        title,
        notes: notes ?? '',
        warmup: warmup ?? '',
        blocks: normalizedBlocks,
        cooldown: cooldown ?? '',
        completed: completed ?? false,
      };
      const workouts = { ...(op.workouts || {}), [date]: newWorkout };
      await client.patchWorkoutsById(client_id, { workouts });
      return textContent(
        `Saved "${title}" to ${client_id}'s planner on ${date} (${normalizedBlocks.length} blocks).`
      );
    }
  );

  server.registerTool(
    'delete_client_workout',
    {
      title: 'Delete a workout from a client\'s planner',
      description:
        'Removes the workout on `date` from the client\'s planner. CONFIRM client + date with the trainer before invoking.',
      inputSchema: {
        client_id: z.string().min(1),
        date: DATE_KEY,
      },
    },
    async ({ client_id, date }) => {
      const op = await client.getOperatorById(client_id);
      const all = { ...(op.workouts || {}) };
      if (!all[date]) {
        return textContent(`No workout on ${date} to delete for ${client_id}.`);
      }
      const title = (all[date]?.title as string) || 'workout';
      delete all[date];
      await client.patchWorkoutsById(client_id, { workouts: all });
      return textContent(`Deleted "${title}" from ${client_id} on ${date}.`);
    }
  );

  server.registerTool(
    'delete_client_meal',
    {
      title: 'Delete a meal from a client\'s nutrition log',
      description:
        'Removes a single meal by id from the client\'s nutrition.meals[date]. Get the id from get_client_nutrition_today/in_range first.',
      inputSchema: {
        client_id: z.string().min(1),
        date: DATE_KEY,
        mealId: z.string().min(1),
      },
    },
    async ({ client_id, date, mealId }) => {
      const op = await client.getOperatorById(client_id);
      const existing = op.nutrition || { meals: {} };
      const existingMeals = (existing.meals as Record<string, Meal[]> | undefined) || {};
      const bucket = existingMeals[date] || [];
      const before = bucket.length;
      const filtered = bucket.filter((m) => m.id !== mealId);
      if (filtered.length === before) {
        return textContent(`No meal ${mealId} on ${date} for ${client_id}.`);
      }
      const nextMeals = { ...existingMeals, [date]: filtered };
      if (filtered.length === 0) delete nextMeals[date];
      const nextNutrition = { ...existing, meals: nextMeals };
      await client.patchProfileById(client_id, { nutrition: nextNutrition });
      return textContent(`Removed meal ${mealId} from ${client_id} on ${date}.`);
    }
  );

  server.registerTool(
    'delete_client_pr',
    {
      title: 'Delete a PR from a client\'s PR board',
      description:
        'Removes a personal record by id from the client\'s PR board. Get the id from get_client_prs first.',
      inputSchema: {
        client_id: z.string().min(1),
        prId: z.string().min(1),
      },
    },
    async ({ client_id, prId }) => {
      const op = await client.getOperatorById(client_id);
      const prs = (op.prs as PRRecord[]) || [];
      const filtered = prs.filter((p) => p.id !== prId);
      if (filtered.length === prs.length) {
        return textContent(`No PR ${prId} found on ${client_id}.`);
      }
      await client.patchWorkoutsById(client_id, { prs: filtered });
      return textContent(`Removed PR ${prId} from ${client_id}.`);
    }
  );
}

/** Pull the calling trainer's operator-id off the api-client without
 * adding a public accessor. The cfg property is `private` in the class
 * but accessible via the bracketed-name trick — same outcome, no API
 * leakage. */
function clientOperatorId(c: GunnyApiClient): string {
  return (c as unknown as { cfg: { operatorId: string } }).cfg.operatorId;
}

/** Drop undefined values from a flat partial object. zod's `.optional()`
 * leaves undefined keys present after parsing, which would clobber existing
 * fields in the merged object. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}
