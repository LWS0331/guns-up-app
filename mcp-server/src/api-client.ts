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
    const res = await this.fetch<{ ok?: boolean; operator?: Operator; updated?: Operator }>(
      'PATCH',
      `/api/operators/${this.cfg.operatorId}/profile`,
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
    const res = await this.fetch<{ ok?: boolean; operator?: Operator; updated?: Operator }>(
      'PATCH',
      `/api/operators/${this.cfg.operatorId}/workouts`,
      patch
    );
    return res.operator ?? res.updated ?? (res as unknown as Operator);
  }
}

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
