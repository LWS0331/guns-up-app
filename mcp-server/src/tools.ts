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
import { GunnyApiClient, Meal, PRRecord, Workout, WorkoutBlock } from './api-client.js';

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
      const summary = {
        id: op.id,
        callsign: op.callsign,
        name: op.name,
        intake: op.intake,
        profile: op.profile,
        preferences: op.preferences,
        sitrep: op.sitrep,
        dailyBrief: op.dailyBrief,
        nutritionTargets: op.nutrition?.targets,
        workoutDates: Object.keys(op.workouts || {}).sort(),
        prCount: (op.prs || []).length,
        injuryCount: (op.injuries || []).length,
      };
      return jsonContent(summary);
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
      const all = op.workouts || {};
      const out: Record<string, Workout> = {};
      for (const [date, w] of Object.entries(all)) {
        if (date >= from && date <= to) out[date] = w;
      }
      return jsonContent(out);
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
}
