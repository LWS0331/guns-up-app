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
    | 'junior_soccer'
    | 'junior_soccer_female'
    | 'junior_football';
}

// ---------------------------------------------------------------------------
// ALWAYS-ON: included in every Gunny call regardless of path
// ---------------------------------------------------------------------------

export const OPERATING_MANUAL: CorpusFile = {
  id: 'operating-manual',
  label: 'Gunny Operating Manual',
  path: 'operating-manual.md',
  format: 'md',
  // Size grew 72_109 → 86_088 (Phase 6: Spanish Output Style Guide)
  // → 87_709 (Marine Brand Voice callout — Oorah not Hooah, Marine
  // not soldier, USMC vocabulary). Both additions are always-on;
  // marginal cost vs. cache-hit savings is trivial.
  approxBytes: 87_709,
  description:
    'Persona, scope, refusal boundaries, voice. System-level instructions for Gunny. Includes a Spanish Output Style Guide that activates when language === "es".',
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
  label: 'Hypertrophy / Bodybuilding Periodization Templates + Supplementation & Natural T Protocols',
  path: 'periodization/hypertrophy.md',
  format: 'md',
  approxBytes: 74_163,
  description:
    '5 periodization templates (RP-style hypertrophy blocks, classical bodybuilding splits, volume-progression schemes) PLUS 2 supplementation/lifestyle protocols that integrate with all 5: (13) Operator Supplement Stack — evidence-tiered (A/B/C/D) creatine, protein, caffeine, beta-alanine, citrulline, vit D, omega-3, Mg, Zn, ashwagandha KSM-66, tongkat ali, sleep stack (glycine, melatonin 0.3-0.5mg, tart cherry); fadogia/turkesterone/tribulus/DAA explicitly EXCLUDED with reasoning; CYP1A2 caffeine stratification; phase dosing; third-party testing tier; bloodwork tracking; (14) Natural Testosterone Optimization Protocol — Endocrine Society 2018 + AUA 2018/2024 aligned, sleep/training/nutrition/body-comp/lifestyle/environmental/supplement pillars, debunks the acute-T-spike-→-hypertrophy myth (West & Phillips 2010-2012, Schoenfeld 2013), debunks the no-fap T-boost myth (Jiang 2003 retracted Dec 2021), TRT referral criteria, full bloodwork panel with LC-MS/MS preferences. Both protocols cite their evidence base verbatim.',
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
  //
  // Order is sized for the 400KB Phase 2 budget cap and the loader's
  // break-on-overflow truncation (gunnyCorpus.ts: stops accumulating on
  // first file that would exceed budget). ALWAYS_ON operating manual
  // (~72KB) + CROSSFIT_CORPUS (~278KB) = 350KB. The two small periodization
  // templates (12KB + 9KB) fit immediately after, bringing the total to
  // 371KB, before OLYMPIC_TECHNIQUE (113KB) trips truncation at 484KB.
  // With them earlier in the array, all three small files survive and
  // only OLYMPIC_TECHNIQUE drops — fine because the CrossFit corpus's
  // movement_standards section already covers snatch/clean-and-jerk from
  // a CrossFit-rules perspective. The previous order
  // ([CROSSFIT, OLYMPIC_TECHNIQUE, TACTICAL, OLYMPIC_PERIO]) broke at
  // OLYMPIC_TECHNIQUE and silently dropped both periodization templates
  // that would otherwise have fit, leaving only ALWAYS_ON + CROSSFIT.
  crossfit: [
    CROSSFIT_CORPUS,
    PERIODIZATION_TACTICAL,
    PERIODIZATION_OLYMPIC,
    OLYMPIC_TECHNIQUE,
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
  // Nicotine pouches & oral health — always available so Gunny can
  // answer pouch / dental questions accurately regardless of which
  // training path the operator picked. The QA file is the primary
  // response surface (Q&A pairs already in Gunny's voice). The KB
  // file is structured fact citations behind it. Both load under
  // standard paths; CrossFit's tight budget may truncate one or
  // both — acceptable since CrossFit-specific corpus is higher
  // priority for those operators.
  {
    id: 'nicotine-pouches-qa',
    label: 'Nicotine Pouches Q&A (oral health)',
    path: 'overlays/nicotine-pouches-qa.json',
    format: 'json',
    approxBytes: 31_381,
    description:
      'Q&A pairs covering staining, enamel, cavities, gum recession, leukoplakia, oral cancer, smoking-cessation framing, and pouch-specific harm reduction. Voice already matches Gunny.',
    trigger: 'always',
  },
  {
    id: 'nicotine-pouches-kb',
    label: 'Nicotine Pouches Knowledge Base (oral health)',
    path: 'overlays/nicotine-pouches-kb.json',
    format: 'json',
    approxBytes: 29_976,
    description:
      'Structured fact base with citations: pH chemistry, enamel staining studies (Dalrymple 2021, Liu 2025), nicotine-driven S. mutans virulence, snus epidemiology extrapolations, leukoplakia case reports, evidence-quality grading. Cite sources via [corpus_id: nicotine-pouches-kb].',
    trigger: 'always',
  },
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
      'Long-term athletic development, US Soccer PDI, heading restrictions, biological-age training caps. Already cited by SOCCER_YOUTH_PROMPT in route.ts. Targets the 10-18 age band.',
    trigger: 'junior_soccer',
  },
  {
    id: 'youth-soccer-4-10',
    label: 'Youth Soccer Drills Corpus (ages 4-10)',
    path: 'overlays/youth-soccer-4-10.md',
    format: 'md',
    approxBytes: 380_440,
    description:
      'Parent-coached backyard / park drill corpus for ages 4-10. 267 fully-detailed nodes across 3 age tiers — Tier 1 (4-5, 35 universal nodes), Tier 2 (6-7, 96 nodes covering all 16 positions), Tier 3 (8-10, 136 position-specific nodes). Each node carries setup, instructions, progressions, coaching cues, common mistakes, success metrics, and a verbatim Gunny tactical-drill-sergeant parent script. Sources: US Soccer PDI, FA Youth Award, KNVB, FC Barcelona La Masia, Ajax TIPS, Coerver, Belgian FA, FIFA 11+ Kids, NSCA Youth, Canadian LTAD. Honors US Soccer no-heading-under-U11 policy (foam/beach-ball technique-intro only at age 10, max 6-8 reps) and NSCA Youth no-heavy-load rules. Loads alongside youth-soccer.md so Gunny has both the developmental-research synthesis (10-18) AND the drill-by-drill backyard playbook (4-10) for any soccer junior.',
    trigger: 'junior_soccer',
  },
  {
    id: 'female-youth-soccer-4-10',
    label: 'Female Youth Soccer Drills Corpus (ages 4-10) — companion to youth-soccer-4-10',
    path: 'overlays/female-youth-soccer-4-10.md',
    format: 'md',
    approxBytes: 345_921,
    description:
      'Female-specific companion volume to youth-soccer-4-10.md. 245 nodes — Tier 2 (6-7, 116 nodes across 16 positions) and Tier 3 (8-10, 129 nodes across 16 positions). Tier 1 (4-5) is shared with the male corpus per pre-pubertal parity evidence (Quatman 2008, Ford 2010, Hewett 2015, Roth 2021, Nuzzo 2025) — joint-laxity and neuromuscular sex differences emerge at PHV, not before. Female-specific adaptations integrated throughout: knee-over-toe alignment cues, quiet-landings as default, mistake-reset ritual baked into every drill, process praise > outcome praise, coached-self-awareness debriefs at session end, FIFA 11+ Kids 12-min warm-up opening every Tier 3 session, PEP-derived plyo with mandatory two-foot landings per <=12-yr protocol, Tuck Jump Assessment self-screen every 4 weeks. Voice guardrails: "squad" not "warriors", "battle buddy" not "rival", mastery climate language. Zero heading nodes (US Soccer policy). Sources: Mandelbaum 2005 PEP RCT (n=1,885; 88% Y1 ACL reduction), Rossler 2018 FIFA 11+ Kids RCT (n=3,895; 48-74% reduction), Sugimoto 2014 dose-response, LaBella 2011 cluster RCT, AAP / Brenner 2016 specialization, Smoll-Smith CET, PCA mastery-climate frameworks, Erica Suter (Mulholland) Strong Female Athlete / Total Youth Soccer Fitness / Female Athlete High Performance. Loads in addition to youth-soccer-4-10.md when juniorSoccerFemale is true; the female nodes are preferred over their male-corpus counterparts at Tier 2 and Tier 3.',
    trigger: 'junior_soccer_female',
  },
  {
    id: 'youth-football',
    label: 'Youth Football (Junior Operator) Reference',
    path: 'overlays/youth-football.md',
    format: 'md',
    approxBytes: 50_254,
    description:
      '34-position football corpus (15 offense / 13 defense / 6 special teams) split across three age bands (10-12 / 13-15 / 16-18). Each band covers drills, S&C programming, game IQ / film, key progressions, common mistakes, and position-specific safety. Coach persona layer (Gunny voice scaled per band) + do-not-do list (no 1RM under 14, no live OL/DL collisions at 10-12, head-injury / concussion protocols per CDC Heads Up). Sources: USA Football, NFHS, NSCA Youth, AAP, Mike Boyle, Eric Cressey, Driveline.',
    trigger: 'junior_football',
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
  /**
   * Female junior on the soccer track. When true, the female-specific
   * companion corpus (female-youth-soccer-4-10.md) loads in addition
   * to the default male / universal youth-soccer-4-10.md. Tier 1
   * (ages 4-5) is shared via the male file per pre-pubertal parity
   * evidence; Tier 2 / Tier 3 in the female file integrate ACL-protective
   * cues, quiet-landings defaults, mistake-reset ritual, and process-
   * praise voice patterns. Defaults to false when bio sex is unknown
   * — no breakage if intake never captures the field.
   */
  juniorSoccerFemale?: boolean;
  /** youth/junior operator on the football track */
  juniorFootball?: boolean;
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
 *
 * Junior operators (juniorSoccer / juniorFootball === true) skip the
 * adult PATH_CORPUS entirely — they don't have a training-path
 * selection, and loading the full kitchen sink would push them past
 * budget. They get ALWAYS_ON (operating manual + exercises) plus
 * their sport-specific youth overlay plus any conditional overlays
 * (injury, FMS) that still apply.
 */
export function selectCorpus(input: CorpusSelectionInput): CorpusFile[] {
  const isJunior = !!input.juniorSoccer || !!input.juniorFootball;
  const path = normalizePath(input.trainingPath);
  const files: CorpusFile[] = isJunior
    ? [...ALWAYS_ON]
    : [...ALWAYS_ON, ...PATH_CORPUS[path]];

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
      case 'junior_soccer_female':
        include = !!input.juniorSoccerFemale;
        break;
      case 'junior_football':
        include = !!input.juniorFootball;
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
