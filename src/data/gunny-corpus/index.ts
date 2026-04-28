// Gunny Corpus Manifest
//
// Phase 1: file inventory + path-based selection rules. No I/O here.
// Phase 2 (loader, buildGunnyContext.ts wiring) reads the chosen files.
//
// Mission stays tactical + crossfit: those paths get the densest corpus
// coverage (Olympic lifting + tactical periodization + always-on exercises).

export type TrainingPath =
  | 'bodybuilding'
  | 'crossfit'
  | 'powerlifting'
  | 'athletic'
  | 'tactical'
  | 'hybrid'
  | 'gunny_pick';

export type CorpusFormat = 'json' | 'md';

export interface CorpusFile {
  id: string;
  label: string;
  /** path relative to this directory (src/data/gunny-corpus) */
  path: string;
  format: CorpusFormat;
  /** approximate raw size in bytes — used by Phase 2 to budget prompt tokens */
  approxBytes: number;
  description: string;
}

export interface CorpusOverlay extends CorpusFile {
  trigger:
    | 'always'
    | 'injury_present'
    | 'lifestage_pregnancy'
    | 'lifestage_postpartum'
    | 'fms_assessment'
    | 'junior_soccer';
}

// ---------------------------------------------------------------------------
// ALWAYS-ON: included in every Gunny call regardless of path
// ---------------------------------------------------------------------------

export const OPERATING_MANUAL: CorpusFile = {
  id: 'operating-manual',
  label: 'Gunny Operating Manual',
  path: 'operating-manual.md',
  format: 'md',
  approxBytes: 72_109,
  description:
    'Persona, scope, refusal boundaries, voice. System-level instructions for Gunny.',
};

export const EXERCISES_ENRICHED: CorpusFile = {
  id: 'exercises-enriched',
  label: 'Enriched Exercise Library',
  path: 'exercises-enriched.json',
  format: 'json',
  approxBytes: 525_720,
  description:
    'Exercise library with movement patterns, primary/secondary muscles, energy systems, loading styles, common substitutions (with reason + context). Phase 2 must filter to operator-relevant subset before injecting into prompt.',
};

export const ALWAYS_ON: CorpusFile[] = [OPERATING_MANUAL, EXERCISES_ENRICHED];

// ---------------------------------------------------------------------------
// PATH CORPUS: keyed by intake.trainingPath
// ---------------------------------------------------------------------------

const POWERLIFTING_TECHNIQUE: CorpusFile = {
  id: 'powerlifting-technique',
  label: 'Powerlifting Technique & Federation Reference',
  path: 'paths/powerlifting.json',
  format: 'json',
  approxBytes: 99_037,
  description:
    'Squat/bench/deadlift technique, federation rule variations (IPF, USAPL, USPA, IPL, SPF, WRPF, WPC), meet prep, equipped vs raw.',
};

const OLYMPIC_TECHNIQUE: CorpusFile = {
  id: 'olympic-technique',
  label: 'Olympic Weightlifting Technique Reference',
  path: 'paths/olympic-weightlifting.json',
  format: 'json',
  approxBytes: 113_727,
  description:
    'Snatch and Clean & Jerk — phases, athlete cues, coach biomechanics, common errors, drills. Foundational for tactical and CrossFit operators.',
};

const PERIODIZATION_POWERLIFTING: CorpusFile = {
  id: 'periodization-powerlifting',
  label: 'Powerlifting Periodization Templates',
  path: 'periodization/powerlifting.md',
  format: 'md',
  approxBytes: 22_042,
  description:
    '7 templates: Wendler 5/3/1 (BBB), Sheiko, Westside Conjugate, Smolov Jr, Texas Method, Madcow 5x5, RPE-based linear.',
};

const PERIODIZATION_HYPERTROPHY: CorpusFile = {
  id: 'periodization-hypertrophy',
  label: 'Hypertrophy / Bodybuilding Periodization Templates',
  path: 'periodization/hypertrophy.md',
  format: 'md',
  approxBytes: 15_139,
  description:
    '5 templates spanning RP-style hypertrophy blocks, classical bodybuilding splits, and volume-progression schemes.',
};

const PERIODIZATION_TACTICAL: CorpusFile = {
  id: 'periodization-tactical',
  label: 'Tactical / Military Periodization Templates',
  path: 'periodization/tactical.md',
  format: 'md',
  approxBytes: 12_466,
  description:
    '5 templates including Tactical Barbell I & II — strength + conditioning concurrent training for selection prep, PFT, rucking.',
};

const PERIODIZATION_OLYMPIC: CorpusFile = {
  id: 'periodization-olympic',
  label: 'Olympic Weightlifting Periodization Templates',
  path: 'periodization/olympic.md',
  format: 'md',
  approxBytes: 9_342,
  description:
    '3 templates including Catalyst Athletics block periodization, Bulgarian-style daily max, Hatch squat program.',
};

const TACTICAL_FITNESS_CORPUS: CorpusFile = {
  id: 'tactical-fitness-corpus',
  label: 'Tactical Fitness Corpus (10 modules + assessment standards)',
  path: 'paths/tactical-fitness.md',
  format: 'md',
  approxBytes: 62_932,
  description:
    '10 programming modules covering foundational tactical fitness through SWAT/HRT operator selection, plus Appendix A with current 2026 assessment standards (AFT, Marine PFT/CFT, Navy PRT, Air Force PFRA, FBI PFT, BUD/S PST, Ranger RPA, CPAT, NTOA SWAT PFQ, Cooper LE norms). Sourced from MTI / Tactical Barbell / SOFLETE / StrongFirst / NSCA TSAC + service doctrine FM 7-22 H2F, MCO 6100.13A, DAFMAN 36-2905. Methodology disagreements (MTI vs TB on percentage vs 3RM loading, concurrent vs phase-based) flagged inline.',
};

const CROSSFIT_CORPUS: CorpusFile = {
  id: 'crossfit-corpus',
  label: 'CrossFit Corpus (methodologies + benchmarks + standards + principles)',
  path: 'paths/crossfit.json',
  format: 'json',
  approxBytes: 278_219,
  description:
    'Master CrossFit reference — schemas, methodologies (CrossFit HQ, CompTrain, Misfit, PRVN, etc.), benchmarks (Girls + Heroes + Classics + Open WODs + Games events), movement standards, programming principles. Phase 2 loader must subset to operator-relevant entries (their goal, available equipment) before injecting into prompt to stay within token budget.',
};

/**
 * Path → corpus files. Order matters: items earlier in the array are
 * higher-priority for prompt inclusion when the loader has to truncate.
 */
export const PATH_CORPUS: Record<TrainingPath, CorpusFile[]> = {
  bodybuilding: [PERIODIZATION_HYPERTROPHY],

  // CrossFit blends Olympic lifting + conditioning. The CrossFit master
  // corpus (methodologies + benchmarks + movement standards + programming
  // principles) is the centerpiece; Olympic technique + tactical/olympic
  // periodization fill in the strength/conditioning periodization side.
  crossfit: [
    CROSSFIT_CORPUS,
    OLYMPIC_TECHNIQUE,
    PERIODIZATION_TACTICAL,
    PERIODIZATION_OLYMPIC,
  ],

  powerlifting: [POWERLIFTING_TECHNIQUE, PERIODIZATION_POWERLIFTING],

  // Athletic = explosive power + conditioning. Olympic lifts are the
  // primary power tool; tactical templates cover concurrent strength+cond.
  athletic: [OLYMPIC_TECHNIQUE, PERIODIZATION_TACTICAL],

  // Tactical: the 10-module Tactical Fitness Corpus is the operational
  // brain (foundational base building → SWAT/HRT prep, plus Appendix A
  // current 2026 assessment standards). Periodization templates cover
  // the strength+conditioning concurrent training side. Olympic technique
  // included because the clean is foundational for selection-style
  // training.
  tactical: [
    TACTICAL_FITNESS_CORPUS,
    PERIODIZATION_TACTICAL,
    OLYMPIC_TECHNIQUE,
  ],

  hybrid: [
    TACTICAL_FITNESS_CORPUS,
    PERIODIZATION_TACTICAL,
    OLYMPIC_TECHNIQUE,
    POWERLIFTING_TECHNIQUE,
    PERIODIZATION_POWERLIFTING,
    PERIODIZATION_HYPERTROPHY,
    PERIODIZATION_OLYMPIC,
    CROSSFIT_CORPUS,
  ],

  // Gunny needs the full knowledge base to recommend a path well.
  gunny_pick: [
    TACTICAL_FITNESS_CORPUS,
    PERIODIZATION_TACTICAL,
    OLYMPIC_TECHNIQUE,
    POWERLIFTING_TECHNIQUE,
    PERIODIZATION_POWERLIFTING,
    PERIODIZATION_HYPERTROPHY,
    PERIODIZATION_OLYMPIC,
    CROSSFIT_CORPUS,
  ],
};

// ---------------------------------------------------------------------------
// OVERLAYS: triggered by intake flags, layered on top of path corpus
// ---------------------------------------------------------------------------

export const OVERLAYS: CorpusOverlay[] = [
  {
    id: 'fms',
    label: 'Functional Movement Screen Reference',
    path: 'overlays/fms.md',
    format: 'md',
    approxBytes: 52_250,
    description:
      'FMS scoring (Deep Squat, Hurdle Step, In-Line Lunge, Shoulder Mobility, ASLR, TSPU, RS), screen interpretation, corrective progressions.',
    trigger: 'fms_assessment',
  },
  {
    id: 'rehab-pt',
    label: 'Rehab & Physical Therapy Reference',
    path: 'overlays/rehab-pt.md',
    format: 'md',
    approxBytes: 55_234,
    description:
      'Common injury workarounds, return-to-train progressions, when to refer to a clinician. Loaded when operator has any active injury.',
    trigger: 'injury_present',
  },
  {
    id: 'pregnancy-postpartum',
    label: 'Pregnancy & Postpartum Training',
    path: 'overlays/pregnancy-postpartum.md',
    format: 'md',
    approxBytes: 68_912,
    description:
      'Trimester-specific modifications, contraindications, postpartum return-to-train, diastasis recti, pelvic floor considerations.',
    trigger: 'lifestage_pregnancy',
  },
  {
    id: 'youth-soccer',
    label: 'Youth Soccer (Junior Operator) Reference',
    path: 'overlays/youth-soccer.md',
    format: 'md',
    approxBytes: 45_090,
    description:
      'Long-term athletic development, US Soccer PDI, heading restrictions, biological-age training caps. Already cited by SOCCER_YOUTH_PROMPT in route.ts.',
    trigger: 'junior_soccer',
  },
];

// ---------------------------------------------------------------------------
// SELECTOR: stateless, side-effect-free. Phase 2 loader reads file contents.
// ---------------------------------------------------------------------------

export interface CorpusSelectionInput {
  trainingPath: TrainingPath | string | undefined;
  hasActiveInjury?: boolean;
  /** 'pregnancy' | 'postpartum' | null/undefined */
  lifeStage?: string | null;
  /** intake assessment in progress (FMS may be triggered) */
  fmsRequested?: boolean;
  /** youth/junior operator on the soccer track */
  juniorSoccer?: boolean;
}

const KNOWN_PATHS: TrainingPath[] = [
  'bodybuilding',
  'crossfit',
  'powerlifting',
  'athletic',
  'tactical',
  'hybrid',
  'gunny_pick',
];

function normalizePath(p: string | undefined | null): TrainingPath {
  if (!p) return 'gunny_pick';
  return (KNOWN_PATHS as string[]).includes(p) ? (p as TrainingPath) : 'gunny_pick';
}

/**
 * Returns the ordered corpus file list for an operator. Phase 2 loader is
 * responsible for reading file contents, applying token budget, and
 * formatting into the Gunny system prompt.
 */
export function selectCorpus(input: CorpusSelectionInput): CorpusFile[] {
  const path = normalizePath(input.trainingPath);
  const files: CorpusFile[] = [...ALWAYS_ON, ...PATH_CORPUS[path]];

  for (const overlay of OVERLAYS) {
    let include = false;
    switch (overlay.trigger) {
      case 'always':
        include = true;
        break;
      case 'injury_present':
        include = !!input.hasActiveInjury;
        break;
      case 'lifestage_pregnancy':
        include = input.lifeStage === 'pregnancy';
        break;
      case 'lifestage_postpartum':
        include = input.lifeStage === 'postpartum';
        break;
      case 'fms_assessment':
        include = !!input.fmsRequested;
        break;
      case 'junior_soccer':
        include = !!input.juniorSoccer;
        break;
    }
    if (include) files.push(overlay);
  }

  return files;
}

/** Total approximate bytes of selected corpus — for Phase 2 budgeting. */
export function approxCorpusBytes(files: CorpusFile[]): number {
  return files.reduce((sum, f) => sum + f.approxBytes, 0);
}

/** Manifest for diagnostics / admin views. */
export const CORPUS_MANIFEST = {
  alwaysOn: ALWAYS_ON,
  paths: PATH_CORPUS,
  overlays: OVERLAYS,
} as const;
