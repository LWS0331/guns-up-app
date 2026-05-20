/**
 * Thin client for gunnyai.fit's REST API, scoped to one trainer. The MCP
 * tool handlers compose against this — they don't talk to fetch directly,
 * so retries / error shapes / auth are in one place.
 *
 * Auth: every call sends `x-operator-api-key` (validated server-side by
 * requireTrainerAuth). The same secret the trainer puts in their Claude.ai
 * connector is the one this client uses upstream — no second key store.
 */

export interface ApiClientConfig {
  baseUrl: string;
  operatorId: string;
  apiKey: string;
}

export class GunnyApiClient {
  constructor(private readonly cfg: ApiClientConfig) {}

  private async fetch<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.cfg.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-operator-api-key': this.cfg.apiKey,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `gunnyai.fit ${method} ${path} → ${res.status} ${res.statusText}: ${text.slice(0, 500)}`
      );
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      // Some endpoints return plain text; pass through.
      return text as unknown as T;
    }
  }

  /** Full operator record — profile, intake, workouts, nutrition, prs, dayTags, etc.
   * gunnyai.fit wraps the operator in { operator } (matches PUT's response shape);
   * unwrap here so tool handlers get the bare object. */
  async getOperator(): Promise<Operator> {
    return this.getOperatorById(this.cfg.operatorId);
  }

  /** Fetch an arbitrary operator by id. Used by the client-roster tools
   * (trainer reading their assigned clients' data). Server enforces
   * trainer-of-target access in GET /api/operators/[id] — calling this
   * with a non-client id results in 403, which we surface as an Error. */
  async getOperatorById(operatorId: string): Promise<Operator> {
    const res = await this.fetch<{ operator: Operator }>(
      'GET',
      `/api/operators/${operatorId}`
    );
    return res.operator;
  }

  /** Fetch the operators visible to the calling trainer. Server-side
   * (GET /api/operators) returns: self + clients (trainerId === me) +
   * other trainers (for client-side trainer picker). Filter the
   * roster down to actual clients in the tool layer. */
  async listVisibleOperators(): Promise<Operator[]> {
    const res = await this.fetch<{ operators: Operator[] }>('GET', '/api/operators');
    return Array.isArray(res.operators) ? res.operators : [];
  }

  /** Targeted PATCH against the profile subroute (skips workouts to avoid races).
   * Server returns `{ ok: true, operator }` — unwrap to the bare row. */
  async patchProfile(patch: Partial<Operator>): Promise<Operator> {
    return this.patchProfileById(this.cfg.operatorId, patch);
  }

  /** PATCH /profile on an arbitrary operator. Used by client-roster
   * writes — trainer-of-target authorization enforced server-side via
   * TRAINER_FIELDS (training-facing data + trainerNotes). Writes to a
   * non-client operator 403. */
  async patchProfileById(operatorId: string, patch: Partial<Operator>): Promise<Operator> {
    const res = await this.fetch<{ ok?: boolean; operator?: Operator; updated?: Operator }>(
      'PATCH',
      `/api/operators/${operatorId}/profile`,
      patch
    );
    return res.operator ?? res.updated ?? (res as unknown as Operator);
  }

  /** Targeted PATCH against the workouts subroute. Accepts workouts, prs,
   * injuries, AND dayTags — the server route allowlists all four despite
   * the name. Server returns `{ ok: true, updated }` (not `operator`,
   * inconsistent with the profile route but that's what's on the wire). */
  async patchWorkouts(patch: {
    workouts?: Record<string, Workout>;
    prs?: PRRecord[];
    injuries?: unknown[];
    dayTags?: Record<string, DayTag>;
  }): Promise<Operator> {
    return this.patchWorkoutsById(this.cfg.operatorId, patch);
  }

  /** PATCH /workouts on an arbitrary operator. Used by client-roster
   * writes. Same trainer-of-target authorization as patchProfileById. */
  async patchWorkoutsById(
    operatorId: string,
    patch: {
      workouts?: Record<string, Workout>;
      prs?: PRRecord[];
      injuries?: unknown[];
      dayTags?: Record<string, DayTag>;
    }
  ): Promise<Operator> {
    const res = await this.fetch<{ ok?: boolean; operator?: Operator; updated?: Operator }>(
      'PATCH',
      `/api/operators/${operatorId}/workouts`,
      patch
    );
    return res.operator ?? res.updated ?? (res as unknown as Operator);
  }

  /** List active wearable connections for an operator.
   * GET /api/wearables?operatorId=<id> — server enforces self/admin/trainer-of-target. */
  async listWearables(operatorId: string): Promise<WearableConnection[]> {
    const res = await this.fetch<{ connections: WearableConnection[] }>(
      'GET',
      `/api/wearables?operatorId=${encodeURIComponent(operatorId)}`
    );
    return Array.isArray(res.connections) ? res.connections : [];
  }

  /** Latest cached wearable snapshot for an operator.
   * GET /api/wearables/latest?operatorId=<id>. Same auth model. */
  async getWearableLatest(operatorId: string): Promise<WearableLatestResponse> {
    return this.fetch<WearableLatestResponse>(
      'GET',
      `/api/wearables/latest?operatorId=${encodeURIComponent(operatorId)}`
    );
  }

  /** Create a macrocycle for an operator. The server wraps buildMacroCycle —
   * caller supplies goal metadata only; block sequence is generated. */
  async createMacrocycle(
    operatorId: string,
    input: {
      type: string;
      name: string;
      targetDate: string;
      priority?: 1 | 2;
      targetMetrics?: Record<string, number>;
      today?: string;
    }
  ): Promise<{ ok: boolean; cycle: unknown }> {
    return this.fetch<{ ok: boolean; cycle: unknown }>(
      'POST',
      `/api/operators/${operatorId}/macrocycles`,
      input
    );
  }

  /** Update a macrocycle's goal. If targetDate changes, the server calls
   * recomputeOnGoalDateChange so blocks regenerate. */
  async updateMacrocycle(
    operatorId: string,
    cycleId: string,
    patch: {
      name?: string;
      targetDate?: string;
      priority?: 1 | 2;
      targetMetrics?: Record<string, number>;
      status?: 'active' | 'completed' | 'paused' | 'cancelled';
      today?: string;
    }
  ): Promise<{ ok: boolean; cycle: unknown }> {
    return this.fetch<{ ok: boolean; cycle: unknown }>(
      'PATCH',
      `/api/operators/${operatorId}/macrocycles/${cycleId}`,
      patch
    );
  }

  /** Delete a macrocycle by id. */
  async deleteMacrocycle(
    operatorId: string,
    cycleId: string
  ): Promise<{ ok: boolean; removedId: string }> {
    return this.fetch<{ ok: boolean; removedId: string }>(
      'DELETE',
      `/api/operators/${operatorId}/macrocycles/${cycleId}`
    );
  }

  /** Apply one or more surgical modifications to a workout. PRESERVES
   * workout.results (logged sets/weights) unlike the full PATCH /workouts
   * which overwrites the whole day. Block IDs preserved across swaps so
   * per-set logged results still map to the correct block. */
  async modifyWorkout(
    operatorId: string,
    date: string,
    modifications: WorkoutModificationInput[]
  ): Promise<{
    ok: boolean;
    applied: number;
    skipped: Array<{ type: string; reason: string }>;
    workout: Workout;
  }> {
    return this.fetch(
      'POST',
      `/api/operators/${operatorId}/workouts/${date}/modifications`,
      { modifications }
    );
  }
}

/** Surgical workout modifications. Mirrors src/lib/workoutModification.ts
 * minus the prefill_weights variant (live-state only, not persisted). */
export type WorkoutModificationInput =
  | {
      type: 'swap_exercise';
      targetBlockId?: string;
      targetExerciseName?: string;
      changes: { exerciseName?: string; prescription?: string; videoUrl?: string };
    }
  | {
      type: 'add_block';
      afterBlockId?: string;
      afterExerciseName?: string;
      newBlock: {
        type: 'exercise' | 'conditioning';
        exerciseName?: string;
        prescription?: string;
        videoUrl?: string;
        format?: string;
        description?: string;
      };
    }
  | {
      type: 'remove_block';
      targetBlockId?: string;
      targetExerciseName?: string;
    }
  | {
      type: 'update_prescription';
      targetBlockId?: string;
      targetExerciseName?: string;
      changes: { prescription?: string; exerciseName?: string };
    }
  | {
      type: 'reorder_blocks';
      newOrder: string[];
    };

// ── Loose type aliases. The MCP doesn't need a full mirror of the app's
// types — it just shuttles JSON. These exist for IDE help and to mark
// intent in the api-client signatures.

export interface Operator {
  id: string;
  callsign?: string;
  name?: string;
  workouts?: Record<string, Workout>;
  nutrition?: {
    targets?: MacroTargets;
    meals?: Record<string, Meal[]>;
    /** Hydration totals in oz, keyed by YYYY-MM-DD. Written by the Gunny
     * chat <hydration_json> handler and by the MCP log_hydration tool. */
    hydration?: Record<string, number>;
  };
  prs?: PRRecord[];
  injuries?: unknown[];
  dayTags?: Record<string, DayTag>;
  sitrep?: unknown;
  dailyBrief?: unknown;
  intake?: Record<string, unknown>;
  profile?: Record<string, unknown> & { goals?: string[] };
  preferences?: Record<string, unknown>;
  /** Daily readiness check-ins keyed by YYYY-MM-DD. */
  dailyReadiness?: Record<string, DailyReadinessEntry>;
  [k: string]: unknown;
}

export interface DailyReadinessEntry {
  date: string;
  recordedAt: string;
  readiness?: number;
  sleep?: number;
  stress?: number;
  energy?: number;
  mood?: string;
  notes?: string;
}

export interface Workout {
  id: string;
  date: string;
  title: string;
  notes?: string;
  warmup?: string;
  blocks: WorkoutBlock[];
  cooldown?: string;
  completed?: boolean;
  results?: unknown;
  [k: string]: unknown;
}

export type WorkoutBlock =
  | { type: 'exercise'; id?: string; sortOrder?: number; exerciseName: string; prescription: string; videoUrl?: string; isLinkedToNext?: boolean }
  | { type: 'conditioning'; id?: string; sortOrder?: number; format: string; description: string; isLinkedToNext?: boolean };

export interface Meal {
  id?: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time?: string;
}

export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface PRRecord {
  id?: string;
  exercise: string;
  weight: number;
  reps?: number;
  date: string;
  notes?: string;
  type?: 'strength' | 'endurance' | 'consistency' | 'milestone';
  path?: string;
}

export interface DayTag {
  color: string;
  note?: string;
}

/** WearableConnection row (Vital-backed). The full row carries internal
 * fields (vital_user_id, refresh_token, etc.) that the server-side
 * projection strips before returning. */
export interface WearableConnection {
  id: string;
  operatorId: string;
  provider: string;
  active: boolean;
  connectedAt?: string;
  lastSyncAt?: string | null;
  scopes?: string[];
  // syncData blob varies wildly by provider — left as unknown.
  syncData?: unknown;
}

/** /api/wearables/latest response shape. `snapshot` is the cached
 * syncData blob (HRV / sleep / activity / etc. — provider-shaped).
 * `currentHR` is the server's best-effort normalization. */
export interface WearableLatestResponse {
  ok: boolean;
  connected: boolean;
  provider?: string;
  lastSyncAt?: string | null;
  snapshot?: unknown;
  currentHR?: number | null;
}
