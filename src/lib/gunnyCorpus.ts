// Gunny Corpus Loader — SERVER-ONLY.
//
// Reads corpus files from disk based on selectCorpus() and formats them into
// a single string ready to be concatenated into Gunny's system prompt.
// Memoizes both raw file reads and rendered selections so the loader pays
// the disk-read cost once per process lifetime (corpus files don't change
// without a redeploy).
//
// Why this is server-only: uses node:fs. Anything that runs in the browser
// (e.g. buildGunnyContext.ts, which is shared) must NOT import this module.
// The intended call site is src/app/api/gunny/route.ts.

import fs from 'node:fs';
import path from 'node:path';
import {
  selectCorpus,
  approxCorpusBytes,
  type CorpusFile,
  type CorpusSelectionInput,
  type TrainingPath,
} from '@/data/gunny-corpus';

const CORPUS_DIR = path.join(process.cwd(), 'src', 'data', 'gunny-corpus');

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------

const fileCache = new Map<string, string>();
const renderedCache = new Map<string, RenderedCorpus>();

export interface RenderedCorpus {
  /** Pre-formatted string for direct concatenation into the system prompt. */
  text: string;
  /** Total bytes of `text` (UTF-8) — useful for logging / budget telemetry. */
  bytes: number;
  /** IDs of files included, in inclusion order. */
  fileIds: string[];
  /** True if any file was dropped to stay under the byte budget. */
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Defaults — cap the corpus at a sane size to protect the prompt budget.
// 500 KB ≈ 125K tokens. Bumped from 400KB → 500KB on May 1 2026 so the
// always-on nicotine pouches corpus (~60KB across QA + KB) fits inside
// the CrossFit path budget without dropping Olympic technique. Math:
//   manual (88) + crossfit (278) + perio_tac (12) + perio_oly (9) +
//   oly_tech (113) + nicotine_qa (31) + nicotine_kb (30) = 561KB
// → still over 500KB, so CrossFit will drop nicotine_kb (lowest
// priority) but keep oly_tech and nicotine_qa. Tactical / bodybuilding /
// powerlifting / athletic / hybrid all have ample headroom.
// Anthropic prompt caching keeps the per-call cost trivial after the
// first warm-up regardless of size — the budget is about avoiding
// runaway prompt growth, not per-call cost.
// ---------------------------------------------------------------------------

const DEFAULT_BUDGET_BYTES = 500_000;

// Files we never inline-inject regardless of selection: they're either too
// large for the prompt, or surfaced through other channels (tool calls,
// filtered subsets) in later phases.
const SKIP_FROM_PROMPT: ReadonlySet<string> = new Set([
  // 525KB — Phase 2.5 will inject a path-filtered condensed subset.
  'exercises-enriched',
]);

// ---------------------------------------------------------------------------
// File I/O (memoized)
// ---------------------------------------------------------------------------

function readFileMemo(relPath: string): string {
  const cached = fileCache.get(relPath);
  if (cached !== undefined) return cached;
  const abs = path.join(CORPUS_DIR, relPath);
  const contents = fs.readFileSync(abs, 'utf8');
  fileCache.set(relPath, contents);
  return contents;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function formatFileBlock(file: CorpusFile, body: string): string {
  // Tag with id so Gunny can cite it back ("per [corpus_id: …]")
  // and humans can grep server logs for which sources were active.
  return `\n\n[corpus_id: ${file.id}] ${file.label}\n────────\n${body.trim()}\n`;
}

function selectionCacheKey(input: CorpusSelectionInput, budget: number): string {
  return [
    input.trainingPath ?? 'gunny_pick',
    input.hasActiveInjury ? 'inj' : '-',
    input.lifeStage ?? '-',
    input.fmsRequested ? 'fms' : '-',
    input.juniorSoccer ? 'jsoccer' : '-',
    `b${budget}`,
  ].join('|');
}

/**
 * Loads and formats the corpus block for a given operator selection.
 * Pure function of the input + on-disk corpus files. Memoized.
 */
export function loadGunnyCorpus(
  input: CorpusSelectionInput,
  budgetBytes: number = DEFAULT_BUDGET_BYTES,
): RenderedCorpus {
  const cacheKey = selectionCacheKey(input, budgetBytes);
  const cached = renderedCache.get(cacheKey);
  if (cached) return cached;

  const files = selectCorpus(input).filter(f => !SKIP_FROM_PROMPT.has(f.id));

  const blocks: string[] = [];
  const includedIds: string[] = [];
  let totalBytes = 0;
  let truncated = false;

  for (const file of files) {
    let body: string;
    try {
      body = readFileMemo(file.path);
    } catch (err) {
      // Don't fail the whole call if one corpus file is missing — log and skip.
      console.warn(`[gunnyCorpus] failed to read ${file.path}:`, err);
      continue;
    }

    const block = formatFileBlock(file, body);
    const blockBytes = Buffer.byteLength(block, 'utf8');

    if (totalBytes + blockBytes > budgetBytes) {
      truncated = true;
      // Stop accumulating: selectCorpus() already returns highest-priority
      // files first (always-on, then path-specific, then overlays).
      break;
    }

    blocks.push(block);
    includedIds.push(file.id);
    totalBytes += blockBytes;
  }

  const header =
    '\n\n═══ GUNNY CORPUS — REFERENCE MATERIAL ═══\n' +
    'The blocks below are reference material for your coaching. They include\n' +
    'your operating manual, path-specific technique/periodization references,\n' +
    "and any conditional overlays (injury / life-stage / FMS / junior). Cite\n" +
    'sources with [corpus_id: …] when you draw on them. The operator profile\n' +
    'follows after this section — corpus is reference; operator data is truth.';

  const text = totalBytes > 0 ? header + blocks.join('') + '\n═══ END CORPUS ═══\n' : '';

  const rendered: RenderedCorpus = {
    text,
    bytes: Buffer.byteLength(text, 'utf8'),
    fileIds: includedIds,
    truncated,
  };
  renderedCache.set(cacheKey, rendered);
  return rendered;
}

// ---------------------------------------------------------------------------
// Convenience: build CorpusSelectionInput from the operator-context shape
// that route.ts already has. Keeps the call site one-liner clean.
// ---------------------------------------------------------------------------

interface OperatorLikeForCorpus {
  intake?: { trainingPath?: string; lifeStage?: string } | null;
  injuries?: Array<{ status?: string } | null> | null;
  isJunior?: boolean;
  sportProfile?: { sport?: string } | null;
}

export function corpusInputFromOperator(op: OperatorLikeForCorpus): CorpusSelectionInput {
  const injuries = Array.isArray(op.injuries) ? op.injuries : [];
  const hasActiveInjury = injuries.some(
    inj => inj && (inj.status === 'active' || inj.status === 'rehab'),
  );
  const lifeStage =
    op.intake?.lifeStage === 'pregnancy' || op.intake?.lifeStage === 'postpartum'
      ? op.intake.lifeStage
      : null;
  const juniorSoccer = !!op.isJunior && op.sportProfile?.sport === 'soccer';
  return {
    trainingPath: op.intake?.trainingPath as TrainingPath | undefined,
    hasActiveInjury,
    lifeStage,
    fmsRequested: false, // wired from intake-mode in a follow-up
    juniorSoccer,
  };
}

// ---------------------------------------------------------------------------
// Test/diag helpers
// ---------------------------------------------------------------------------

/** Clears the in-memory caches. Used by tests; not called in normal flow. */
export function _resetGunnyCorpusCacheForTests(): void {
  fileCache.clear();
  renderedCache.clear();
}

/** Approx selected-corpus size before disk reads — for logging/telemetry. */
export function previewCorpusBytes(input: CorpusSelectionInput): number {
  return approxCorpusBytes(
    selectCorpus(input).filter(f => !SKIP_FROM_PROMPT.has(f.id)),
  );
}
