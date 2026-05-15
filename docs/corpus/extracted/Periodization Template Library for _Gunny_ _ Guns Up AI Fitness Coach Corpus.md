# Periodization Template Library for "Gunny" — Guns Up AI Fitness Coach Corpus

## Executive Summary

This corpus contains 20 fully-specified, code-ready periodization templates spanning four operator populations: powerlifting/strength (7), bodybuilding/hypertrophy (5), tactical/military (5), and Olympic weightlifting (3). Each template is described with (1) metadata, (2) a deterministic prescription schema for every session, and (3) an algorithmic progression block that a developer can translate into TypeScript without ambiguity. All citations point to original author publications (Wendler's *5/3/1: The Simplest and Most Effective Training System* and *5/3/1 Forever*; Boris Sheiko's *Powerlifting: Foundations and Methods*; K. Black's *Tactical Barbell I & II*; Mark Rippetoe's *Practical Programming for Strength Training*; Greg Everett's *Olympic Weightlifting: A Complete Guide for Athletes & Coaches*; Renaissance Periodization's *Scientific Principles of Hypertrophy Training* by Israetel/Hoffmann/Davis/Feather; Louie Simmons' Westside Barbell publications; and the original Smolov/Hatch/Bulgarian source materials).

A unified TypeScript interface (`PeriodizationTemplate`) is proposed at the end of the report so all 20 templates can be normalized into a single schema that drops cleanly into the Guns Up codebase.

---

## POWERLIFTING / STRENGTH TEMPLATES (7)

### 1. Wendler 5/3/1 — Boring But Big (BBB) 4-Day

```typescript
{
  id: "wendler_531_bbb_4day",
  displayName: "5/3/1 Boring But Big",
  author: "Jim Wendler",
  source: "5/3/1: The Simplest and Most Effective Training System (2009); Beyond 5/3/1; 5/3/1 Forever",
  population: "strength",
  experienceLevel: "intermediate",
  cycleWeeks: 4,                    // 3 working weeks + 1 deload
  sessionsPerWeek: 4,
  equipment: ["barbell","rack","bench","plates","optional_chinup_bar"],
  inputs: { trainingMaxes: { squat:"number", bench:"number", deadlift:"number", press:"number" } },
  trainingMaxRule: "TM = 0.90 * tested1RM (or 0.85 if conservative). All percentages computed from TM.",
  weeklyStructure: [
    { day: 1, mainLift: "press",    supplementalLift: "press",    accessory: ["pull","ab/single-leg"] },
    { day: 2, mainLift: "deadlift", supplementalLift: "deadlift", accessory: ["pull","ab/single-leg"] },
    { day: 3, mainLift: "bench",    supplementalLift: "bench",    accessory: ["pull","ab/single-leg"] },
    { day: 4, mainLift: "squat",    supplementalLift: "squat",    accessory: ["pull","ab/single-leg"] }
  ],
  mainSetSchema: {
    week1: [{pct:0.65,reps:5},{pct:0.75,reps:5},{pct:0.85,reps:"5+"}],   // "+" = AMRAP
    week2: [{pct:0.70,reps:3},{pct:0.80,reps:3},{pct:0.90,reps:"3+"}],
    week3: [{pct:0.75,reps:5},{pct:0.85,reps:3},{pct:0.95,reps:"1+"}],
    week4_deload: [{pct:0.40,reps:5},{pct:0.50,reps:5},{pct:0.60,reps:5}] // no AMRAP
  },
  supplementalBBB: { sets:5, reps:10, pctOfTM_cycle1:0.50, pctOfTM_cycle2:0.60, pctOfTM_cycle3:0.70 },
  accessoryRule: "Pick one push, one pull, one core/single-leg. 25–50 reps each, light/moderate, not to failure.",
  restPrescriptions: { mainSets:"2–5 min", bbb:"60–120 s", accessory:"60–90 s" }
}
```

**Algorithmic Progression Logic.** All loads are computed off a **Training Max (TM) = 0.90 × true 1RM**. Each cycle is 4 weeks (3 work weeks + 1 deload). Loads each week are deterministic percentages of TM as shown. The last set of every working week is AMRAP — the operator does as many reps as possible with 1–2 reps in the tank (form-stop, not failure). Cycle-to-cycle progression is fixed: at the end of each cycle, **TM_squat += 10 lb, TM_deadlift += 10 lb, TM_bench += 5 lb, TM_press += 5 lb** (in kg: +5 / +5 / +2.5 / +2.5). BBB supplemental load increases each cycle on the canonical "BBB Challenge": 50% TM → 60% TM → 70% TM, then reset to 50% with the new (higher) TM.

**Failure Response & Deload Trigger.** If the operator fails to hit the prescribed minimum reps on the AMRAP set (Week 1 5+ < 5 reps, Week 2 3+ < 3 reps, Week 3 1+ fails) for that lift in two consecutive cycles, the TM is **reset to 0.90 × current TM** (a 10% deload) and progression resumes. In *5/3/1 Forever*, Wendler replaces the in-cycle deload with the **7th Week Protocol**: after two "leader" cycles, run a 7th-week deload OR a TM Test (work up 70%×5, 80%×5, 90%×5, then attempt TM ×3–5; if you cannot get 3 clean reps at TM, drop TM to whatever 5RM ÷ 0.85 implies). Then run an "anchor" cycle.

**AMRAP → TM bump (optional)**. A common autoregulation: if Week 3 1+ set yields ≥ 5 reps, bump TM by an extra 5 lb (upper) / 10 lb (lower) for the next cycle. This is the canonical "rep PR threshold."

**Integration Notes.** Recommend for operators with 1–3 years of consistent training, solid technique on the big four, and 3–5 days/week availability. Contraindicated for true novices (use GZCLP). For limited equipment, swap BBB supplemental for First Set Last (FSL) 5×5 at Week 1's first percentage. Common mistake: setting TM at true 1RM — Wendler's core principle is "start too light."

---

### 2. GZCLP (Cody Lefever Linear Progression)

```typescript
{
  id: "gzclp",
  displayName: "GZCLP",
  author: "Cody Lefever (u/gzcl)",
  source: "Reddit r/gzcl original infographic; The GZCL Method articles",
  population: "strength",
  experienceLevel: "novice",
  cycleWeeks: "indefinite (run 3–6 months)",
  sessionsPerWeek: 3,                           // A1, B1, A2, B2 — rotates over 4 sessions
  equipment: ["barbell","rack","bench","plates","accessory_implements"],
  inputs: { startingT1: "5RM × 0.85 per main lift", startingT2: "T1 × 0.65 (approx)" },
  weeklyStructure: [
    { sessionId: "A1", T1:"squat",    T2:"bench",   T3:"lat_pulldown_or_row" },
    { sessionId: "B1", T1:"OHP",      T2:"deadlift", T3:"chinup_or_curl" },
    { sessionId: "A2", T1:"bench",    T2:"squat",   T3:"row" },
    { sessionId: "B2", T1:"deadlift", T2:"OHP",     T3:"chinup_or_lat_raise" }
  ],
  tierSchema: {
    T1: { stage1:{sets:5,reps:3,lastIsAMRAP:true},
          stage2:{sets:6,reps:2,lastIsAMRAP:true},
          stage3:{sets:10,reps:1,lastIsAMRAP:true} },
    T2: { stage1:{sets:3,reps:10}, stage2:{sets:3,reps:8}, stage3:{sets:3,reps:6} },
    T3: { sets:3, reps:"15+ (last set AMRAP, target ≥25)" }
  }
}
```

**Algorithmic Progression Logic.**
- **T1 progression rule** (per session, per main lift): if all sets completed and AMRAP ≥ minimum reps, add **+5 lb upper / +10 lb lower** (kg: +2.5 / +5) next session. If failed, advance one stage: 5×3+ → 6×2+ → 10×1+ at the **same weight**. If you fail at stage 3 (10×1+), retest 5RM, set T1 weight to **0.85 × new 5RM**, restart at stage 1.
- **T2 progression rule**: hit 3×10 → +5/+10 lb next session. Fail → drop to 3×8, then 3×6 at same weight; if fail at 3×6, restart with weight **+10 lb (lower) / +5 lb (upper) over the last 3×10 weight that succeeded**.
- **T3 progression rule**: weight increases by smallest available increment when last set AMRAP ≥ 25 reps (or operator-set threshold).
- **Deload trigger**: failing T1 stage 3 twice on the same lift → mandatory 7-day deload at 70% of current T1 weights, then restart progression.

**1:2:3 volume guideline.** For every rep at T1, do ~2 at T2 and ~3 at T3.

**Integration Notes.** Best entry-point program for operators with < 1 year of consistent barbell experience and minimum equipment. Selecting between 3-day and 4-day variants: default 3 day/week (alternating A1/B1/A2/B2 across sessions). Coaching cue: "stop AMRAP 1–2 reps short of failure to preserve form."

---

### 3. Westside Conjugate (Basic 4-Day Template)

```typescript
{
  id: "westside_conjugate_basic",
  displayName: "Westside Barbell Conjugate (Basic Template)",
  author: "Louie Simmons / Westside Barbell",
  source: "Westside-barbell.com basic template articles; Book of Methods; Dave Tate elitefts.com",
  population: "strength",
  experienceLevel: "advanced",
  cycleWeeks: "indefinite (3-week DE waves)",
  sessionsPerWeek: 4,
  equipment: ["barbell","rack","bench","bands","chains","specialty_bars(optional)","box","sled"],
  weeklyStructure: [
    { day: "Mon", focus: "ME_lower" },   // 36–48h before...
    { day: "Wed", focus: "ME_upper" },
    { day: "Fri", focus: "DE_lower" },
    { day: "Sat", focus: "DE_upper" }
  ],
  ME_protocol: {
    rule: "Work up to top 1–3 RM in a chosen variation (box squat, good morning, rack pull, floor press, board press, close-grip bench, incline bench, etc.).",
    rotation: "Change ME variation every 1–3 weeks; do not repeat exercise within 4–6 weeks at intermediate level.",
    accessoryAfterME: "3–4 exercises × 3–4 sets × 6–12 reps, target weak points (triceps, upper back, posterior chain, abs)."
  },
  DE_lower_wave_geared: [
    { week:1, scheme:"12×2 box squat @ 50% bar + 25% accommodating resistance (≈75% effective)" },
    { week:2, scheme:"10×2 box squat @ 55% bar + 25% AR (≈80%)" },
    { week:3, scheme:"8×2 box squat @ 60% bar + 25% AR (≈85%)" },
    // followed by 6×1, 5×1, 4×1 (or 8/6/4×2) deadlift @ 65–75% on same day
  ],
  DE_lower_wave_raw: [
    { week:1, scheme:"12×2 @ 65–70% (45–50% bar + 20% AR)" },
    { week:2, scheme:"10×2 @ 70–75%" },
    { week:3, scheme:"8×2 @ 75–80%" }
  ],
  DE_upper_wave: [
    { week:1, scheme:"9×3 bench @ 50% bar + 25% AR, rest ~60s, rotate grip every 3 sets" },
    { week:2, scheme:"9×3 @ 55% + 25%" },
    { week:3, scheme:"9×3 @ 60% + 25%" }
  ],
  accessoryAfterDE: "3–4 exercises × 3–4 × 12–20 reps; higher volume / lower intensity than ME days.",
  restPrescriptions: { ME:"3–5 min", DE:"45–90 s", accessory:"60–90 s" }
}
```

**Algorithmic Progression Logic.** The Conjugate Method is non-linear and exercise-rotation-driven. The 3-week pendulum wave on DE days is deterministic (50/55/60% + 25% AR for geared lifters; 60/65/70% bar weight for raw). After each 3-week wave, **change the DE variation** (different bar, stance, band setup, or specialty bar) and reset the wave. **ME days have no fixed weekly percentage**: the operator works up to a top 1–3RM PR in a rotating exercise. Because exercise variations change every 1–3 weeks, "PR" is per-exercise, per-variation. Every fourth week, ME work is replaced by repetition-method (RE) sets (e.g., 5×5 at 70%) for restoration.

**Cycle-to-cycle progression.** Track exercise PRs in a rotating database. Operator beats their previous PR for that specific variation (e.g., "SSB box squat 1RM"). True 1RMs are retested ~every 9 weeks via meet or mock meet.

**Failure Response.** If DE bar speed slows below ~0.8 m/s (or visibly grinds), drop percentage by 5% and continue. If ME PR fails on a variation, change the variation next session and try again in 4–6 weeks.

**Integration Notes.** Advanced lifters only (3+ years). Requires bands, chains, or specialty bars for full effect; novice variant by Syatt drops accommodating resistance and uses straight weight at 60–70% with 8–12×3 for DE bench. Common mistakes: skimping on accessory (80% of total volume is accessory), repeating ME exercises, and grinding DE reps.

---

### 4. Sheiko #29 (Russian Preparatory Block)

```typescript
{
  id: "sheiko_29",
  displayName: "Sheiko #29 Preparatory Block",
  author: "Boris Sheiko",
  source: "Sheiko, Powerlifting: Foundations and Methods (RP Strength, 2018); originally from Russian coaching manuals",
  population: "strength",
  experienceLevel: "intermediate",
  cycleWeeks: 4,
  sessionsPerWeek: 3,
  equipment: ["barbell","rack","bench","plates","platform"],
  inputs: { competition1RM: { squat:"number", bench:"number", deadlift:"number" } },
  trainingMaxRule: "Use TRUE competition 1RM (not Wendler-style training max).",
  weeklyStructure: [
    { day:"Mon", focus:"squat + bench"          },
    { day:"Wed", focus:"deadlift_to_knees + incline_bench + accessory" },
    { day:"Fri", focus:"squat + bench (variant)" }
  ],
  // Representative week 1 (canonical Sheiko #29 — see Lift Vault / eastern bloc lifting blog):
  week1: [
    { day:1, exercises: [
      {lift:"bench_press",  sets:[ {pct:0.50,reps:5},{pct:0.60,reps:4},{pct:0.70,reps:3},{pct:0.75,reps:3,sets:5} ]},
      {lift:"squat",        sets:[ {pct:0.50,reps:5},{pct:0.60,reps:4},{pct:0.70,reps:3,sets:5} ]},
      {lift:"db_fly",       sets:5, reps:10 },
      {lift:"good_morning", sets:5, reps:5 }
    ]},
    { day:2, exercises: [
      {lift:"bench_press",      sets:[ {pct:0.50,reps:5},{pct:0.60,reps:4},{pct:0.70,reps:3,sets:5} ]},
      {lift:"deadlift_to_knees", sets:[ {pct:0.50,reps:3},{pct:0.60,reps:3},{pct:0.70,reps:2,sets:4} ]},
      {lift:"incline_bench",    sets:4, reps:6 },
      {lift:"dips",             sets:5, reps:5 }
    ]},
    { day:3, exercises: [
      {lift:"squat",       sets:[ {pct:0.50,reps:5},{pct:0.60,reps:4},{pct:0.70,reps:3,sets:5} ]},
      {lift:"bench_press", sets:[ {pct:0.50,reps:5},{pct:0.60,reps:4},{pct:0.70,reps:3,sets:5} ]},
      {lift:"db_fly",      sets:5, reps:10 },
      {lift:"good_morning", sets:5, reps:5 }
    ]}
  ],
  weekToWeekRule: "Volume tapers up over weeks 1–3 then drops in week 4. All percentages explicitly written into the spreadsheet — no autoregulation."
}
```

**Algorithmic Progression Logic.** Sheiko #29 is a **fully prescribed percentage program** — the algorithm reads from a 4-week × 3-day percentage table (full table on Lift Vault and Boostcamp). All sets are sub-maximal (50–80% range, capped at ~85% in later weeks). Because Sheiko #29 is a preparatory block, it is meant to feed into #30 (accumulation), #31 (transmutation), then #32 (peaking) for a 16-week meet prep. Bench is trained 3×/week, squat 2×/week, deadlift (or DL variant) 1×/week.

**Cycle-to-cycle progression.** After completing #29 → #30 → #31 → #32, the operator tests 1RM on competition day. If a PR is set, the next macrocycle (re-running #29) uses the new 1RM as the input. If reps were missed during the cycle, **drop the 1RM input by 5%** before the next run. There is no in-cycle TM bump — all loads are written and locked.

**Failure / Deload.** Sheiko has built-in volume undulation; week 4 of each block functions as the deload. If the operator misses ≥ 2 prescribed sets in a session due to fatigue, repeat the same week before progressing.

**Integration Notes.** For competitive or aspiring competitive raw powerlifters with ≥ 1 year experience and high recovery capacity. Sessions run 90–120 min. **Do not add significant accessory work** beyond what's prescribed. For limited time, use "mini-Sheiko" — same percentages, drop one bench session per week.

---

### 5. Smolov Base Cycle (Squat) — 13-Week Full Program

```typescript
{
  id: "smolov_base_squat",
  displayName: "Smolov Squat (Full 13-Week Cycle)",
  author: "Sergey Smolov; popularized by Pavel Tsatsouline (Powerlifting USA, 2001)",
  source: "Powerlifting USA (Apr 2001); Wikipedia: Smolov Squat Routine",
  population: "strength",
  experienceLevel: "advanced",
  cycleWeeks: 13,
  sessionsPerWeek: "varies (3–4)",
  equipment: ["barbell","rack","plates","knee_sleeves_recommended"],
  inputs: { squat1RM: "number (use 0.90 × true 1RM for safer outcomes)" },
  phases: [
    { phase:"phase_in", weeks:[1,2], freq:3, notes:"acclimation; 8×3 @ 65–70% + lunges day 2; week 2 work up to 5×5 @ 80–85%" },
    { phase:"base_mesocycle", weeks:[3,4,5,6], freq:4,
      schedule:[
        { day:"Mon", scheme:"4×9 @ 70%" },
        { day:"Wed", scheme:"5×7 @ 75%" },
        { day:"Fri", scheme:"7×5 @ 80%" },
        { day:"Sat", scheme:"10×3 @ 85%" }
      ],
      weeklyLoadAddition: { week3:"+0", week4:"+20 lb (or +10 kg)", week5:"+10 lb (or +5 kg) over week 4", week6_test:"deload then test 1RM" }
    },
    { phase:"switching", weeks:[7,8], freq:"2–3", notes:"Speed/box squats at 50–60% of NEW 1RM; light recovery." },
    { phase:"intense_mesocycle", weeks:[9,10,11,12], freq:3,
      schedule:[
        { day:1, scheme:"4×5 @ 75%" },
        { day:2, scheme:"5×5 @ 80%" },
        { day:3, scheme:"6×4 @ 85%" },
        // weekly loads escalate; week 12 includes singles at 90–95%+
      ]
    },
    { phase:"taper", weeks:[13], notes:"Light squats; test new 1RM end of week." }
  ]
}
```

**Algorithmic Progression Logic.** Two-phase percentage progression. **Base mesocycle (weeks 3–6)** uses a fixed 4-day weekly template (4×9, 5×7, 7×5, 10×3). The starting load is the % of 1RM shown above; weight is then added in absolute terms each week: **Week 4 = Week 3 + 20 lb (10 kg); Week 5 = Week 4 + 10 lb (5 kg)**. If the operator fails reps in a session, drop the addition (use +10 lb / +5 lb instead of +20). Week 6 is a test week — operator establishes a new 1RM. **All percentages in weeks 9–12 (intense mesocycle) are computed against the NEW 1RM** from Week 6, not the original.

**Failure response.** If reps are repeatedly missed during base mesocycle, reduce next session's load by 5%. If failure persists for two sessions in a row, stop the cycle, take 7 days light, and restart base mesocycle from Week 3 with the input 1RM × 0.90.

**Smolov Jr. variant (3-week, commonly used for bench).** 4 sessions/week:
- Day 1: 6×6 @ 70% Day 2: 7×5 @ 75% Day 3: 8×4 @ 80% Day 4: 10×3 @ 85%
- Week 2: same scheme + 5 lb (upper) / 10 lb (lower) Week 3: + another 5 / 10 lb

**Integration Notes.** Recommend only for advanced operators (squat ≥ 1.5× BW, ≥ 2 yrs consistent training) on a caloric surplus, sleeping 8+ hrs. Contraindicated for cuts, beginners, or anyone with knee/back issues. Knee sleeves strongly recommended. For Guns Up, Smolov Jr. (3 weeks) is the safer default; offer full Smolov only as an "advanced operator specialty cycle."

---

### 6. Texas Method (3-Day Intermediate)

```typescript
{
  id: "texas_method_3day",
  displayName: "Texas Method (3-Day Volume/Recovery/Intensity)",
  author: "Mark Rippetoe / Glenn Pendlay",
  source: "Rippetoe, Practical Programming for Strength Training, 3rd ed.",
  population: "strength",
  experienceLevel: "intermediate",
  cycleWeeks: "indefinite",
  sessionsPerWeek: 3,
  equipment: ["barbell","rack","bench","plates"],
  inputs: { current5RM: { squat:"number", bench:"number", press:"number", deadlift:"number" } },
  weeklyStructure: [
    { day:"Mon (Volume)",   exercises:[
      {lift:"squat",         sets:5, reps:5, intensity:"~90% of 5RM (≈77% 1RM)"},
      {lift:"bench_or_press_alternating", sets:5, reps:5, intensity:"~90% of 5RM"},
      {lift:"deadlift",      sets:1, reps:5, intensity:"~77% 1RM"}
    ]},
    { day:"Wed (Recovery)", exercises:[
      {lift:"squat",         sets:2, reps:5, intensity:"~80% of Mon weight (≈62% 1RM)"},
      {lift:"alt_press",     sets:3, reps:5, intensity:"~70% 1RM"},
      {lift:"chin_up",       sets:3, reps:"AMRAP"},
      {lift:"back_extension",sets:5, reps:10, intensity:"BW"}
    ]},
    { day:"Fri (Intensity)",exercises:[
      {lift:"squat",         sets:1, reps:5, intensity:"new 5RM (~85% 1RM)"},
      {lift:"bench_or_press",sets:1, reps:5, intensity:"new 5RM"},
      {lift:"power_clean",   sets:5, reps:3, intensity:"~70% 1RM"} // alternative: deficit deadlift
    ]}
  ],
  pressAlternation: "Bench and Press alternate between Volume Day and Intensity Day each week."
}
```

**Algorithmic Progression Logic.** **Linear weekly progression on the Intensity Day 5RM.** When operator hits a new 5RM on Friday: **stored1RM_lift += 5 lb (lower) / 2.5 lb (upper)** for the next week. Volume Day weight is recalculated as ~90% of the new 5RM. Recovery Day weight = 80% of new Volume Day weight. The press and bench alternate, so each upper lift effectively progresses 2.5 lb every 2 weeks.

**Stall / failure protocol (cycle through rep ranges on Intensity Day).** When 5RM stalls (failed for 2 weeks at same weight): switch to **2×3 at +5 lb**, then **3×2**, then **5×1** as needed. Each rep-scheme reduction earns more progress. If 1RM still stalls, **deload 10–15% and re-run weeks at higher rate**, or transition to a 4-day Texas Method (Andy Baker variant) where Volume Day is split across 2 days.

**Integration Notes.** For graduates of Starting Strength / GZCLP. Requires caloric surplus and ≥ 8 hrs sleep — Rippetoe is explicit. Contraindicated for over-40 operators (use Andy Baker's 4-day variant instead). Operator must be able to power clean (or sub deficit deadlifts).

---

### 7. Madcow 5×5 (Bill Starr Intermediate)

```typescript
{
  id: "madcow_5x5",
  displayName: "Madcow 5×5",
  author: "Bill Starr (original), 'Madcow' (geocities adaptation)",
  source: "WackyHQ / Stronglifts mirrors of original geocities pages; Lift Vault spreadsheet",
  population: "strength",
  experienceLevel: "intermediate",
  cycleWeeks: 9,                    // commonly run as 9-week ramp
  sessionsPerWeek: 3,
  equipment: ["barbell","rack","bench","plates"],
  inputs: { stored1RM: { squat:"number", bench:"number", deadlift:"number", row:"number", incline:"number" } },
  weeklyStructure: [
    { day:"Mon (Heavy)",  ramp:[
      {lift:"squat",    sets:5, repsRamp:[5,5,5,5,5], pctRamp:[0.50,0.625,0.75,0.875,1.00], pctOf:"target5RM" },
      {lift:"bench",    sets:5, repsRamp:[5,5,5,5,5], pctRamp:[0.50,0.625,0.75,0.875,1.00], pctOf:"target5RM" },
      {lift:"row",      sets:5, repsRamp:[5,5,5,5,5], pctRamp:[0.50,0.625,0.75,0.875,1.00], pctOf:"target5RM" }
    ]},
    { day:"Wed (Light)", exercises:[
      {lift:"squat",    sets:4, reps:5, pctOf5RM:[0.50,0.625,0.75,0.875]},
      {lift:"incline",  sets:4, reps:5, similar:true},
      {lift:"deadlift", sets:4, reps:5, similar:true}
    ]},
    { day:"Fri (Medium-Top)", ramp:[
      {lift:"squat",    sets:[{ramp:4×5},{topSet:1×3, topPct:1.025},{backoff:1×8, pct:0.80}]},
      {lift:"bench",    similar:true},
      {lift:"row",      similar:true}
    ]}
  ]
}
```

**Algorithmic Progression Logic.** Madcow uses a **weekly +2.5% absolute load progression**. Week 2's Monday top set = Week 1's Friday top set. Week 2's Friday top set = Week 1's Friday × 1.025. Net effect: ~2.5–5 lb on lower body lifts and ~1.25–2.5 lb on upper body lifts per week. The ramp sets use 50%, 62.5%, 75%, 87.5%, 100% of that week's top set. Wednesday is a deliberate light day at ~80% of Monday's top set (4 sets, no top set).

**Cycle / failure response.** Madcow is intentionally a **ramp/peak/reset** program. After 4–9 weeks of progression, operator stalls and resets to **3 weeks earlier** (i.e., drops back 3 weeks of progression: target5RM × (1.025)^(-3) ≈ −7.3%) and ramps again. If operator hits a 5RM PR on Friday, **stored1RM is updated** (using Brzycki: 1RM = weight × 36 / (37 − reps)).

**Integration Notes.** For graduates of novice LP who can no longer add weight workout-to-workout. Excellent powerbuilding template — better hypertrophy than pure powerlifting due to row inclusion. Does **not** include overhead press in default form (use incline). Common mistake: starting too heavy — Madcow is a 9-week ramp, so weeks 1–3 should feel almost too easy.

---

## BODYBUILDING / HYPERTROPHY TEMPLATES (5)

### 8. Renaissance Periodization (RP) Hypertrophy 4-Day

```typescript
{
  id: "rp_hypertrophy_4day",
  displayName: "RP Hypertrophy Mesocycle (4-Day Upper/Lower)",
  author: "Dr. Mike Israetel / Dr. James Hoffmann / Dr. Melissa Davis / Jared Feather",
  source: "Israetel et al., Scientific Principles of Hypertrophy Training (RP, 2021)",
  population: "hypertrophy",
  experienceLevel: "intermediate",
  cycleWeeks: 5,                    // 4 accumulation + 1 deload (typical)
  sessionsPerWeek: 4,
  equipment: ["full_gym_or_home_gym_with_rack_dumbbells_machines"],
  inputs: { volumeLandmarks: "Per muscle group: MV, MEV, MAV, MRV in weekly hard sets" },
  defaultLandmarks_intermediate_male: {
    chest:    {MV:8,  MEV:10, MRV:22},
    back:     {MV:8,  MEV:10, MRV:25},
    quads:    {MV:6,  MEV:8,  MRV:20},
    hamstrings:{MV:4, MEV:6,  MRV:16},
    glutes:   {MV:0,  MEV:0,  MRV:16},
    shoulders:{MV:8,  MEV:8,  MRV:26},
    biceps:   {MV:5,  MEV:8,  MRV:20},
    triceps:  {MV:4,  MEV:6,  MRV:18},
    calves:   {MV:6,  MEV:8,  MRV:16}
  },
  weeklyStructure: [
    { day:1, focus:"upper_A", muscles:["chest","back","shoulders","triceps"] },
    { day:2, focus:"lower_A", muscles:["quads","hamstrings","glutes","calves"] },
    { day:3, focus:"upper_B", muscles:["back","chest","shoulders","biceps"] },
    { day:4, focus:"lower_B", muscles:["hamstrings","quads","glutes","calves"] }
  ],
  intensityRule: { repRange:"5–30 (most work 8–20)", RIR_progression:[3,2,1,0_or_1,"deload"] },
  setProgression: "Add 1 set per muscle per week; start Week 1 at MEV."
}
```

**Algorithmic Progression Logic.**
- **Week 1**: each muscle group is trained at **MEV** (start at the floor). Effort = **3–4 RIR** (reps in reserve).
- **Each subsequent week**: **add 1 set per muscle group per week** (split across the 2 sessions that train that muscle, e.g., +1 set on either Upper A or Upper B for chest). Reps stay roughly stable. RIR drops by 1 each week: Wk1→3 RIR, Wk2→2 RIR, Wk3→1 RIR, Wk4→0–1 RIR. **Load adjustment:** add weight each week to maintain target reps as RIR falls (educated guess; if operator hits the same reps with one less RIR, load is correctly progressing).
- **Deload trigger** (any one of):
  1. Total weekly sets for a muscle have reached **MRV** (e.g., chest at 22 sets/wk).
  2. Performance drops session-over-session on the same load (e.g., reps decline).
  3. Two of: persistent soreness, joint discomfort, sleep disruption, mood drop.
- **Deload week**: volume = **MEV (50% of Wk1 sets)**, load = **first half of week at Week 1's load, second half at ½ of Week 1's load**. Then reset for next mesocycle.
- **Cycle-to-cycle progression**: each new mesocycle starts ~1 set per muscle higher than the previous mesocycle's MEV (gradual MEV creep with training age). After 3 mesocycles, run a maintenance/diet phase or recalibrate landmarks.
- **Per-set autoregulation algorithm** (per RP): for each set, target the prescribed RIR; if completed reps > target rep range upper bound at the prescribed RIR, **add +5 lb (upper) / +10 lb (lower)** next session for that exercise. If reps fall below the lower bound at the prescribed RIR, hold weight constant.

**Failure response.** If operator misses target reps by ≥ 2 reps with the prescribed weight on a given exercise, that's a stimulus-fatigue mismatch — drop the next session's volume by 1 set on that muscle and check sleep/nutrition.

**Integration Notes.** Best for operators with ≥ 1 year of training, primarily aesthetics-driven, willing to track sets and RIR. Contraindicated for tactical operators in high-stress phases (recovery cost too high). Pairs poorly with heavy concurrent endurance training. Needs full-gym equipment for exercise variety.

---

### 9. Push/Pull/Legs (PPL) 6-Day High-Frequency

```typescript
{
  id: "ppl_6day",
  displayName: "Push/Pull/Legs 6-Day Hypertrophy",
  author: "Generic high-frequency split (popularized by Reddit r/Fitness 'metallicadpa PPL' & Weightology)",
  source: "Schoenfeld et al. 2016 frequency meta; Weightology 6-day PPL article",
  population: "hypertrophy",
  experienceLevel: "intermediate-advanced",
  cycleWeeks: "indefinite (deload every 6–8 weeks)",
  sessionsPerWeek: 6,
  equipment: ["full_gym"],
  weeklyStructure: [
    { day:1, focus:"push_A",  muscles:["chest","shoulders","triceps"] },
    { day:2, focus:"pull_A",  muscles:["back","rear_delts","biceps"] },
    { day:3, focus:"legs_A",  muscles:["quads","hamstrings","glutes","calves"] },
    { day:4, focus:"push_B",  muscles:["shoulders","chest","triceps"] },
    { day:5, focus:"pull_B",  muscles:["back","rear_delts","biceps"] },
    { day:6, focus:"legs_B",  muscles:["hamstrings","quads","glutes","calves"] },
    { day:7, focus:"rest" }
  ],
  prescriptionPerSession: {
    compounds: { count:1-2, sets:3-5, reps:"5–8 (strength bias)", rest:"3–5 min" },
    isolations:{ count:3-4, sets:3-4, reps:"8–15", rest:"60–90 s" }
  },
  weeklySetTargetPerMuscle: { chest:12-18, back:12-18, shoulders:12-18, quads:10-16, hamstrings:8-12, biceps:8-12, triceps:8-12 }
}
```

**Algorithmic Progression Logic.** Standard **double progression**: for each exercise, work within a rep range (e.g., 8–12). When operator hits all sets at the top of the range with good form, **add load (+5 lb upper / +10 lb lower)** next session and reset to bottom of rep range. Each muscle group is trained 2× per week, so each exercise has 2 progression opportunities per week.

**Push A vs Push B differentiation**: Push A leads with a heavy barbell compound (bench, OHP) at lower reps (5–8); Push B leads with a different compound or dumbbell variation at moderate reps (8–12). This intra-week variation manages fatigue and provides hypertrophic stimulus diversity.

**Deload trigger.** Every 6–8 weeks OR when performance stagnates for 2+ weeks. Deload = volume reduced by 50%, load same; or volume same, load reduced by 30%.

**Integration Notes.** Best for hypertrophy-focused operators with 6+ days/week availability. Can be reduced to 3-day PPL (each muscle 1×/week) for time-constrained operators, but at cost of growth rate. Common mistake: too many compound lifts at heavy intensity — burns out CNS. Schoenfeld 2016 meta-analysis supports the 2× weekly frequency.

---

### 10. Upper/Lower 4-Day Hypertrophy

```typescript
{
  id: "upper_lower_4day",
  displayName: "Upper/Lower 4-Day Hypertrophy",
  author: "Generic intermediate hypertrophy split (Weightology, MuscleEvo, Hevy templates)",
  source: "Schoenfeld 2016 frequency meta; Hevy/Weightology hypertrophy program library",
  population: "hypertrophy",
  experienceLevel: "intermediate",
  cycleWeeks: "indefinite (8–12 week blocks before reassessment)",
  sessionsPerWeek: 4,
  equipment: ["barbell","rack","bench","dumbbells","cable_machine"],
  weeklyStructure: [
    { day:"Mon", focus:"upper_A", template:[
      {lift:"barbell_bench",   sets:4, reps:"6–8",  RIR:1-2 },
      {lift:"barbell_row",     sets:4, reps:"6–8",  RIR:1-2 },
      {lift:"OHP",             sets:3, reps:"8–10", RIR:1-2 },
      {lift:"lat_pulldown",    sets:3, reps:"10–12",RIR:0-1 },
      {lift:"db_lateral_raise",sets:3, reps:"12–15",RIR:0 },
      {lift:"tricep_extension",sets:3, reps:"10–12",RIR:0 },
      {lift:"barbell_curl",    sets:3, reps:"10–12",RIR:0 }
    ]},
    { day:"Tue", focus:"lower_A", template:[
      {lift:"squat",           sets:4, reps:"5–8",  RIR:1-2 },
      {lift:"romanian_dl",     sets:4, reps:"8–10", RIR:1-2 },
      {lift:"leg_press",       sets:3, reps:"10–12",RIR:0-1 },
      {lift:"leg_curl",        sets:3, reps:"10–15",RIR:0 },
      {lift:"calf_raise",      sets:4, reps:"10–15",RIR:0 },
      {lift:"abs",             sets:3, reps:"10–15",RIR:0 }
    ]},
    { day:"Thu", focus:"upper_B", template:"Variations: incline DB press, weighted pull-up, DB shoulder press, cable row, etc., similar set/rep structure." },
    { day:"Fri", focus:"lower_B", template:"Variations: front squat, deadlift variant, lunge, leg extension, seated calf, etc." }
  ]
}
```

**Algorithmic Progression Logic.** Same **double progression** as PPL: rep range fulfilled at all sets at target RIR → +5 lb (upper) / +10 lb (lower). Each muscle is trained 2×/week.

**Cycle structure.** Run for 8–12 weeks, then deload (50% volume) for 1 week. New block can swap secondary exercises while keeping primary compounds (bench, squat, row, RDL) for continuity of progression.

**Failure response.** Two failed weeks at same load → drop weight 10% and rebuild for 3 weeks, then push past previous PR.

**Integration Notes.** The "default" intermediate hypertrophy template; flexible scheduling, sustainable, accommodates conditioning days. Recommend for operators 1–3 years in, 4 sessions/week available. Easily morphs into PHUL (Power/Hypertrophy Upper Lower) by making Upper A and Lower A "power days" with 3–5 rep compounds and Upper B / Lower B pure hypertrophy.

---

### 11. Arnold Split / Bro Split 6-Day

```typescript
{
  id: "arnold_split_6day",
  displayName: "Arnold Split (Chest+Back / Shoulders+Arms / Legs ×2)",
  author: "Arnold Schwarzenegger",
  source: "The New Encyclopedia of Modern Bodybuilding (1985) — Basic Training Program (Level 1, intermediate version)",
  population: "hypertrophy",
  experienceLevel: "advanced",
  cycleWeeks: "indefinite (deload every 6–8 weeks)",
  sessionsPerWeek: 6,
  equipment: ["full_gym"],
  weeklyStructure: [
    { day:"Mon", focus:"chest+back", template:[
      {lift:"bench_press",       sets:4, reps:"15,10–12,8–10,6"},
      {lift:"incline_bench",     sets:4, reps:"15,10–12,8–10,6"},
      {lift:"db_pullover",       sets:4, reps:"15,10–12,8–10,6"},
      {lift:"wide_grip_pullup",  sets:5, reps:"AMRAP"},
      {lift:"bent_over_row",     sets:5, reps:"15,10–12,8–10,8,6"},
      {lift:"deadlift_or_SLDL",  sets:5, reps:"8"},
      {lift:"abs",               sets:"5×25 crunches"}
    ]},
    { day:"Tue", focus:"shoulders+arms", template:[
      {lift:"clean_and_press",   sets:4, reps:"15,10–12,8–10,6"},
      {lift:"db_lateral_raise",  sets:4, reps:"15,10–12,8–10,6"},
      {lift:"upright_row",       sets:4, reps:"6–10"},
      {lift:"barbell_curl",      sets:4, reps:"6–10"},
      {lift:"db_curl_seated",    sets:4, reps:"6–10"},
      {lift:"close_grip_bench",  sets:4, reps:"6–10"},
      {lift:"tricep_pushdown",   sets:4, reps:"10"},
      {lift:"forearm_work",      sets:4, reps:"10"}
    ]},
    { day:"Wed", focus:"legs+lower_back", template:[
      {lift:"squat",             sets:4, reps:"15,10–12,8–10,6"},
      {lift:"lunge",              sets:4, reps:"8–10"},
      {lift:"leg_curl",          sets:4, reps:"8–10"},
      {lift:"calf_raise",        sets:4, reps:"15"},
      {lift:"good_morning",      sets:4, reps:"10"},
      {lift:"abs",               sets:"5×25"}
    ]},
    { day:"Thu", focus:"chest+back (variations)" },
    { day:"Fri", focus:"shoulders+arms (variations)" },
    { day:"Sat", focus:"legs+lower_back (variations)" }
  ]
}
```

**Algorithmic Progression Logic.** **Reverse-pyramid double progression**: each set descends in reps from 15 → 6 with progressively heavier load. When operator hits the top set's rep target with form, **add weight (+5 lb / +10 lb)** to the top set next session; when they hit the rep target on all sets (across the whole pyramid), increase loads on all sets. Train each muscle to **failure or 1 rep shy** on the heaviest set.

**Failure response.** If unable to hit the prescribed top-set reps for 2 sessions in a row, drop weight 5% on that exercise and rebuild. If overall recovery declines (sleep, soreness), insert deload week (volume −50%).

**Integration Notes.** Demanding, ≥ 90 min sessions, requires full gym, 6 days/week. Best for advanced operators who already have a strong base. Pairs antagonistic muscles (chest+back) for time efficiency and pump. Common mistake: trying to add direct arm work outside Tue/Fri — arms get hammered enough via compounds. **Only use for hypertrophy-priority blocks**, not when paired with heavy conditioning.

---

### 12. Mike Israetel-Style Scientific Hypertrophy Block (Accumulation/Intensification/Deload)

```typescript
{
  id: "israetel_scientific_block",
  displayName: "Scientific Hypertrophy Block (Accumulation → Intensification → Deload)",
  author: "Dr. Mike Israetel / Renaissance Periodization",
  source: "Israetel, Scientific Principles of Hypertrophy Training (RP, 2021); RP Strength blog",
  population: "hypertrophy",
  experienceLevel: "intermediate-advanced",
  cycleWeeks: 6,                    // 4 accumulation + 1 intensification + 1 deload
  sessionsPerWeek: "4–6",
  equipment: ["full_gym"],
  blockStructure: [
    { phase:"accumulation", weeks:[1,2,3,4],
      goal:"build volume, drive hypertrophy",
      volume:"start at MEV, +1 set/muscle/week",
      RIR:[3,2,1,0],
      reps:"8–15 (most work)",
      load:"add weight as RIR falls to maintain rep targets"
    },
    { phase:"intensification", weeks:[5],
      goal:"functional overreach near MRV",
      volume:"hold or +1 set from week 4",
      RIR:[0,1],
      reps:"6–10 (drop slightly)",
      load:"+5 lb per exercise; push close to MRV"
    },
    { phase:"deload", weeks:[6],
      goal:"dissipate fatigue, supercompensate",
      volume:"return to MEV (≈50% of week 5 sets)",
      RIR:[3,4],
      reps:"same",
      load:"½ of week 1 load for second half of deload week"
    }
  ]
}
```

**Algorithmic Progression Logic.** Three-phase block.
- **Accumulation (Wks 1–4).** Same as RP Hypertrophy: start at MEV, add 1 set/muscle/week, RIR drops 3→0. Loads progress by autoregulation (add load when reps stay flat as RIR drops).
- **Intensification (Wk 5).** Volume is held or pushed +1 set; intensity climbs to RIR 0–1; rep range drops to 6–10. This is **functional overreach** — operator may experience temporary performance dips, which is intended.
- **Deload (Wk 6).** Volume back to MEV; load: **first half of the week at week-1's load, second half at ½ of week-1's load**. Reps unchanged.

**Cycle-to-cycle progression.** After deload, run another 6-week block; MEV may have crept up by 1–2 sets per muscle. After 3 such blocks, take a 1-week active rest and consider a maintenance/diet phase.

**Failure / overreach signals.** During accumulation, if reps drop ≥ 2 across 2 consecutive sessions, that's an MRV breach — **deload immediately** rather than completing the planned 4 weeks.

**Integration Notes.** Same population fit as RP Hypertrophy 4-day, but offers explicit intensification phase that operators chasing PRs respond well to. Best for operators who have completed at least one RP-style mesocycle and understand RIR.

---

## TACTICAL / MILITARY TEMPLATES (5)

### 13. Tactical Barbell Operator (3-Day Strength + Conditioning)

```typescript
{
  id: "tb_operator",
  displayName: "Tactical Barbell — Operator Template",
  author: "K. Black",
  source: "Tactical Barbell I: Definitive Strength Training for the Operational Athlete (rev 2nd ed.)",
  population: "tactical",
  experienceLevel: "intermediate",
  cycleWeeks: 6,
  sessionsPerWeek: 3,             // strength; pair with Black/Green protocol conditioning
  equipment: ["barbell","rack","bench","plates","pullup_bar"],
  inputs: { trainingMax: { lift1:"0.90 × 1RM", lift2:"0.90 × 1RM", lift3:"0.90 × 1RM" } },
  cluster_recommended: ["squat","bench","weighted_pullup"],
  cluster_optional_4th: "deadlift (1× per week, end of week)",
  weeklyTemplate: [
    { week:1, scheme:{sets:"3–5", reps:5, pctTM:0.70 } },
    { week:2, scheme:{sets:"3–5", reps:5, pctTM:0.80 } },
    { week:3, scheme:{sets:"3–4", reps:3, pctTM:0.90 } },
    { week:4, scheme:{sets:"3–5", reps:5, pctTM:0.75 } },
    { week:5, scheme:{sets:"3–5", reps:5, pctTM:0.85 } },
    { week:6, scheme:{sets:"3–4", reps:"1–2", pctTM:0.95 } }
  ],
  sessionStructure: "Each session: do 3 main lifts back-to-back at the week's prescribed sets×reps×%TM. Substitute deadlift in for pullups or chins on session 3 if cluster has 4 lifts."
}
```

**Algorithmic Progression Logic.** All weeks deterministic — no in-cycle autoregulation. **Training Max = 0.90 × tested 1RM.** Operator hits prescribed sets×reps×%TM each week of the 6-week wave (two interlocking 3-week sub-waves: 70/80/90 and 75/85/95). After completing 6 weeks, **retest 1RM** (or skip retest and add **+5 lb upper / +10 lb lower** to 1RM input) and repeat the 6-week block. K. Black does not prescribe in-cycle deloads — light weeks 1 and 4 act as built-in recovery.

**Failure response.** If operator fails the 90% or 95% week's reps, they did not complete the cycle — **retest 1RM, drop input by 5–10%**, and re-run the block. Sub-maximal loading means failure should be rare if 1RM is honest.

**Integration with conditioning (Black/Green Protocols from TB II).** TB Operator is designed for concurrent training. Default pairing:
- **Black Protocol** (high-intensity / short-duration conditioning): 2× HIC sessions/week on off-strength days (e.g., 30/30 sprints, kettlebell complexes, sled pushes; 8–20 min total).
- **Green Protocol** (long-duration aerobic): replace HIC with LSS (long, slow, steady) runs/rucks of 45–90 min for endurance-priority operators.

**Integration Notes.** Bread-and-butter for tactical/LE/military operators. Sub-maximal loading + low session count leaves recovery for conditioning, sport practice, and operational duty. Common mistake: pushing too many sets — start at 3 sets minimum, build to 5 over weeks. Operator I/A variant allows 3–10 sets and adds light/heavy days for advanced operators.

---

### 14. Tactical Barbell Fighter (2-Day Minimal Strength)

```typescript
{
  id: "tb_fighter",
  displayName: "Tactical Barbell — Fighter Template",
  author: "K. Black",
  source: "Tactical Barbell I",
  population: "tactical",
  experienceLevel: "intermediate-advanced",
  cycleWeeks: 6,
  sessionsPerWeek: 2,
  equipment: ["barbell","rack","bench","plates","pullup_bar"],
  cluster_typical: ["squat","bench","weighted_pullup","deadlift"],
  weeklyTemplate: [
    { week:1, scheme:{sets:"3–4", reps:5, pctTM:0.70 } },
    { week:2, scheme:{sets:"3–4", reps:5, pctTM:0.80 } },
    { week:3, scheme:{sets:"3–4", reps:3, pctTM:0.90 } },
    { week:4, scheme:{sets:"3–4", reps:5, pctTM:0.75 } },
    { week:5, scheme:{sets:"3–4", reps:5, pctTM:0.80 } },
    { week:6, scheme:{sets:"3–4", reps:3, pctTM:0.90 } }
  ],
  sessionStructure: "Both sessions hit ALL 4 cluster lifts. 70/80/90 wave repeats — no 95% week — because Fighter pairs with high conditioning load."
}
```

**Algorithmic Progression Logic.** Same TM rule and progression rule as Operator: complete 6-week block, retest or +5/+10 lb to input 1RM, repeat. Fighter sacrifices frequency (2× squat/week vs Operator's 3×) for time efficiency, ideal for combat-sport athletes or operators with high sport-practice load. The 70/80/90 waves repeat (no 75/85/95) because Fighter is meant to coexist with high external load.

**Integration Notes.** Best for operators who do BJJ/MMA/boxing 3+ days/week, or are in pre-deployment with high field training. Fighter HT variant (in TB Mass) uses higher reps for hypertrophy.

---

### 15. Tactical Barbell Mass Protocol (Hypertrophy Block)

```typescript
{
  id: "tb_mass_protocol",
  displayName: "Tactical Barbell — Mass Protocol",
  author: "K. Black",
  source: "Tactical Barbell: Mass Protocol",
  population: "tactical",
  experienceLevel: "intermediate-advanced",
  cycleWeeks: 6,
  sessionsPerWeek: 4,             // 3 main days + 1 deadlift day
  equipment: ["barbell","rack","bench","plates","pullup_bar"],
  cluster: ["squat","bench","weighted_pullup","deadlift"],
  weeklyTemplate: [
    { week:1, scheme:{sets:4, reps:6, pctTM:0.75 } },
    { week:2, scheme:{sets:4, reps:5, pctTM:0.80 } },
    { week:3, scheme:{sets:4, reps:3, pctTM:0.90 } },
    { week:4, scheme:{sets:4, reps:6, pctTM:0.75 } },
    { week:5, scheme:{sets:4, reps:4, pctTM:0.85 } },
    { week:6, scheme:{sets:4, reps:3, pctTM:0.90 } }
  ]
}
```

**Algorithmic Progression Logic.** Same Operator-style block progression; Mass uses higher reps (6/5/4) at the same TM percentages, biasing hypertrophy. After block: retest, +5 lb (upper) / +10 lb (lower) added to 1RM, repeat.

**Integration Notes.** Run when an operator wants to add muscle without abandoning the TB system. Pair with Green or low-intensity Black (lighter HIC) — full Black Protocol is not recommended concurrently with Mass.

---

### 16. MTI Operator Sessions / Fluid Periodization Base Fitness (Hector-Style)

```typescript
{
  id: "mti_operator_base_fitness",
  displayName: "MTI Operator Sessions (Hector / Fluid Periodization Base Fitness)",
  author: "Rob Shaul / Mountain Tactical Institute",
  source: "mtntactical.com — Operator Hector training plan; The Fitness Mountain framework",
  population: "tactical",
  experienceLevel: "intermediate",
  cycleWeeks: 7,                  // 6 work + 1 taper/unload
  sessionsPerWeek: 5,
  equipment: ["barbell","plates","rack","bench","pullup_bar","kettlebells_dumbbells","sandbag","ruck","running_route_or_treadmill"],
  attributesTrained: ["strength","work_capacity","military_endurance","chassis_integrity","tactical_agility"],
  fluidPeriodization: "Each cycle, attributes are concurrently trained but cycle to cycle the emphasis can rotate (balanced cycle vs. strength-focus vs. endurance-focus).",
  weeklyTemplate_balanced: [
    { day:"Mon", focus:"strength_TLU + chassis_integrity" },     // total/lower/upper + ART core
    { day:"Tue", focus:"work_capacity (10-min multi-modal) + chassis_integrity" },
    { day:"Wed", focus:"endurance (run or ruck assessment-based intervals)" },
    { day:"Thu", focus:"strength_TLU + tactical_agility" },
    { day:"Fri", focus:"work_capacity (5-min×2 or 20-min grind) + chassis_integrity" },
    { day:"Sat (optional)", focus:"long endurance (60-min easy run or 90-min ruck)" }
  ],
  strengthProgression: {
    name: "TLU (Total/Lower/Upper)",
    structure: "Each strength session = 1 total-body lift (e.g., hinge lift, clean) + 1 lower (e.g., front squat) + 1 upper (e.g., bench)",
    progression: "Assessment-based: test 1RM (or 3RM) week 1, programmed % progression weeks 2–6, retest week 7."
  },
  workCapacityProgression: "Multi-modal events at 10/20-min durations; same event re-tested over weeks; total reps/rounds is the metric.",
  enduranceProgression: {
    runs: "1.5-mile or 3-mile assessment, then 800m/1mi intervals at assessed pace; longer easy runs Saturday.",
    rucks: "Ruck run assessment, then ruck intervals + long easy ruck (45–60 lb load)."
  },
  chassisIntegrity: "ART or ARTE circuits 2×/week (Anti-rotation, Rotation, Total-core, Extension exercise pairing)."
}
```

**Algorithmic Progression Logic.** MTI's "Fluid Periodization" is **assessment-driven**.
- **Strength**: Week 1 = test 1RM or 3RM on the strength exercises; Weeks 2–6 = programmed percentages off the assessed max (typically 70/75/80/85/90% across weeks); Week 7 = retest or unload. If retest > old max, new max becomes input for next cycle. If retest is lower, hold the same max next cycle.
- **Work capacity**: Week 1 = test (e.g., max rounds in 10 min of 5 burpees + 10 sandbag clean-press + 15 air squats); subsequent weeks repeat the test event with 90/95/100/105% target rounds. Re-test in next cycle.
- **Endurance**: same — assessed times become percentage targets for intervals.

**Cycle-to-cycle progression**: Operator rotates between similar plans (Hector → Johnny → Frank Church → Bob Marshall, etc.) to avoid accommodation. Assessment-based progression carries forward.

**Failure / unload.** Week 7 of every cycle is a programmed unload — bodyweight or dumbbell substitutions for barbell, easy-pace runs instead of intervals. Operators are NOT supposed to fail Week 6 prescribed loads; if they do, the assessed max was too high — drop 5–10% next cycle.

**Integration Notes.** Best for active military operators, SWAT, fire/rescue, mountain professionals. Concurrent training is the entire point — don't strip out endurance or chassis integrity. Operators preparing for known events (selection, PFT) drop Base Fitness 6–12 weeks out and switch to event-specific MTI plans.

---

### 17. SOFLETE Hybrid Strength-Endurance (Wolf-Pack / Operator Athlete)

```typescript
{
  id: "soflete_hybrid",
  displayName: "SOFLETE Cognitive Warrior / Operator Hybrid",
  author: "SOFLETE (founders anonymous, active military)",
  source: "soflete.com training pages; Coffee or Die profile (2014 origin, originally a free PDF for SOF selection prep)",
  population: "tactical",
  experienceLevel: "intermediate",
  cycleWeeks: "6 (rolling blocks)",
  sessionsPerWeek: 5-6,
  equipment: ["barbell","rack","plates","kettlebells","sandbag","ruck","ropes","pullup_bar","running_route"],
  attributesTrained: ["strength","power","stamina","endurance","mobility","mental_toughness"],
  weeklyTemplate: [
    { day:"Mon", focus:"strength (compound lift + accessory)" },
    { day:"Tue", focus:"work_capacity (CrossFit-style metcon, 12–25 min)" },
    { day:"Wed", focus:"endurance (run 4–8 mi OR ruck 60–90 min @ 35–45 lb)" },
    { day:"Thu", focus:"strength (different compound + accessory)" },
    { day:"Fri", focus:"work_capacity OR sandbag medley (15–30 min)" },
    { day:"Sat", focus:"long endurance (8+ mi run, 2-hr ruck, swim, or skill day)" }
  ],
  strengthScheme: "Wendler-style 5/3/1 OR 5×5 — most blocks use 4-week wave (60/70/80/90% TM, last set AMRAP).",
  enduranceScheme: "Mix of pace runs, intervals, and long aerobic; rucks scale from 25→55 lb over weeks.",
  workCapacityScheme: "EMOMs, AMRAPs, Tabatas — focused on operational work capacity (carry-press-step combinations)."
}
```

**Algorithmic Progression Logic.** SOFLETE is autoregulation-heavy ("flexible training relying on autoregulatory feedback"). Strength block uses 5/3/1-style TM progression (TM += 5/10 lb per cycle). Endurance progresses by adding ½–1 mile per week to long efforts and tightening pace targets on intervals (e.g., 1-mile time drops 5–10 sec per cycle). Work capacity events are scored (rounds × reps × load) and rescored each cycle.

**Failure response.** SOFLETE explicitly programs in autoregulation: if operator's HRV / sleep / RPE feedback indicates accumulated fatigue (reported via app), the workout substitutes a lighter recovery session. If no app, the rule of thumb: 2 of (poor sleep, sore for >48h, declining performance) = swap that day's hard session for mobility/easy aerobic.

**Integration Notes.** Best for SOF candidates, selection prep, hybrid endurance+strength athletes. Less prescriptive than TB or MTI — requires self-discipline. Pair the AI coach (Gunny) with HRV / sleep tracking inputs for full autoregulation.

---

## OLYMPIC WEIGHTLIFTING TEMPLATES (3)

### 18. Hatch Squat Program (12-Week Front + Back Squat Cycle)

```typescript
{
  id: "hatch_squat_12wk",
  displayName: "Hatch Squat Program (12 Weeks)",
  author: "Coach Gayle Hatch (head coach US 2004 Men's Olympic Weightlifting Team)",
  source: "Hatch's program template (widely circulated; hosted at hatchsquat.com, outlawcoach.wordpress.com PDF, Lift Vault)",
  population: "olympic",
  experienceLevel: "intermediate-advanced",
  cycleWeeks: 12,
  sessionsPerWeek: 2,             // 2 squat sessions per week
  equipment: ["barbell","rack","plates"],
  inputs: { backSquat1RM:"number", frontSquat1RM:"number" },
  // Canonical Hatch percentages — 12-week table from outlawcoach.wordpress.com PDF / hatchsquat.com calculator
  weeklyTable: [
    // each row: [day, lift, sets×reps@%]
    { week:1, day:1, schemes:[ {lift:"back_squat", sets:[{r:5,p:0.65},{r:5,p:0.70},{r:5,p:0.75}]},
                                {lift:"front_squat",sets:[{r:5,p:0.60},{r:5,p:0.65},{r:5,p:0.70}]} ] },
    { week:1, day:2, schemes:[ {lift:"back_squat", sets:[{r:5,p:0.65},{r:5,p:0.70},{r:5,p:0.75},{r:5,p:0.75}]},
                                {lift:"front_squat",sets:[{r:5,p:0.60},{r:5,p:0.65},{r:5,p:0.70}]} ] },
    // ... weeks 2–11 progressively shift toward heavier triples and singles
    { week:6, day:1, schemes:[ {lift:"back_squat", sets:[{r:3,p:0.70},{r:3,p:0.80},{r:2,p:0.85},{r:2,p:0.90}]},
                                {lift:"front_squat",sets:[{r:3,p:0.65},{r:3,p:0.75},{r:2,p:0.80}]} ] },
    { week:11, day:1, schemes:[{lift:"back_squat", sets:[{r:5,p:0.70},{r:5,p:0.80},{r:1,p:0.85},{r:1,p:0.90},{r:1,p:0.95},{r:1,p:1.00},{r:1,p:1.03}]},
                                {lift:"front_squat",sets:[{r:5,p:0.65},{r:4,p:0.75},{r:3,p:0.80}]}] },
    // week 12 = light/test
  ]
}
```

**Algorithmic Progression Logic.** Hatch is a **fully prescribed percentage table** — no autoregulation, no AMRAP. Operator inputs back squat and front squat 1RMs; the program reads exact sets/reps/% for 24 sessions over 12 weeks (back squat first one day, front squat first the alternate day). The volume tapers across the cycle as intensity climbs: weeks 1–3 high reps (sets of 5–8), weeks 4–8 moderate (sets of 3–5), weeks 9–11 singles and doubles culminating in **103% of 1RM attempt in week 11**, week 12 deload + retest.

**Cycle-to-cycle progression.** After the 12-week block, retest both squats (typical PRs +5–25 lb). New 1RMs become inputs for the next cycle. Hatch is meant to be repeated periodically, not run continuously.

**Failure response.** If operator misses a prescribed weight, drop 10–15 lb on the next set and continue. If failure repeats across 2 sessions, 1RM input was too high — restart at week 1 with input × 0.95.

**Integration Notes.** Best for Olympic weightlifters and CrossFitters needing big leg strength. Front+back squats in same session are demanding; superset is intentional. Don't substitute or skip front squats. Common mistake: operators starting with 1RM that's not realistic (test recently). For limited recovery (older/concurrent athletes), use back squat 1RM × 0.93 and front squat × 0.88 as inputs.

---

### 19. Catalyst Athletics Beginner — "Simplest Olympic Program in the World" (3-Day)

```typescript
{
  id: "catalyst_beginner_3day",
  displayName: "Catalyst Athletics Beginner Olympic Lifting (3-Day)",
  author: "Greg Everett",
  source: "Everett, Olympic Weightlifting: A Complete Guide for Athletes & Coaches (3rd ed.); 'Simplest Olympic Weightlifting Program in the World' article",
  population: "olympic",
  experienceLevel: "novice-intermediate",
  cycleWeeks: 4,
  sessionsPerWeek: 3,
  equipment: ["barbell","plates","rack","platform","bumper_plates"],
  weeklyTemplate: [
    { day:1, exercises:[
      { lift:"snatch",       prescription:"week-dependent (see progression)" },
      { lift:"snatch_pull",  prescription:"week-dependent" },
      { lift:"front_squat",  prescription:"week-dependent" }
    ]},
    { day:2, exercises:[
      { lift:"jerk_(behind-the-neck or rack)", prescription:"varies" },
      { lift:"push_press",  prescription:"varies" },
      { lift:"overhead_squat", prescription:"varies" }
    ]},
    { day:3, exercises:[
      { lift:"clean_and_jerk", prescription:"varies" },
      { lift:"clean_pull",     prescription:"varies" },
      { lift:"back_squat",     prescription:"varies" }
    ]}
  ],
  weekProgression: [
    { week:1, mainLifts:"4×3 (find weights operator can handle technically clean)", squats:"4×4 moderate" },
    { week:2, mainLifts:"5×2 (heavier than week 1)", squats:"5×3 moderate-heavy" },
    { week:3, mainLifts:"6×1 (heaviest singles)", squats:"5×3 heavy" },
    { week:4, mainLifts:"3×3 deload (drop loads 10–20%)", squats:"3×4 light", action:"reset cycle or progress to Catalyst Level 2/Beginner Level 1 paid program" }
  ]
}
```

**Algorithmic Progression Logic.** Beginner Olympic programming is **load-by-feel**, not by percentage — weights are explicitly NOT prescribed because beginner technique varies wildly. The structure is fixed: 3 days/week, primary lift (snatch / jerk / clean & jerk) → pull → squat. Across 4-week mesocycles, **rep schemes contract** (3×3 → 5×2 → 6×1 → deload) while load increases each week as the operator tolerates it.

**Cycle-to-cycle progression.** After 4 weeks, drop load by 10–20%, reduce volume by 20–40%, and restart with slightly higher target weights. Once operator can execute the lifts technically and the 4-week cycle becomes too easy, advance to Catalyst Level 1 Beginner Program (Skill Level 1) which has ~5 days/week and full warm-up/accessory prescriptions.

**Failure response.** Olympic lifts respond poorly to grinding — if a rep moves slowly or breaks technique, drop the load 5–10 kg and finish remaining sets cleanly. Don't push for misses.

**Integration Notes.** For operators new to Olympic lifts but with general strength training base. Include a coach or video review when possible — technique > load. Saturday optional 4th day = heavy single snatch, heavy single C&J, heavy single front squat (test). Pair with mobility (overhead, ankle, hip) work daily.

---

### 20. Bulgarian Method (Daily Max Singles)

```typescript
{
  id: "bulgarian_method",
  displayName: "Bulgarian Method (Abadjiev Daily Max)",
  author: "Ivan Abadjiev (Bulgarian National Weightlifting Coach 1968–1989, 1997–2000)",
  source: "Abadjiev's 1975 European Coaches Conference paper; popularized by Max Aita / John Broz / Matt Perryman (Squat Every Day, 2013)",
  population: "olympic",
  experienceLevel: "advanced",
  cycleWeeks: "indefinite (4-week deload pattern)",
  sessionsPerWeek: 5-6,            // up to 2× daily for full Bulgarian
  equipment: ["barbell","plates","rack","platform","bumper_plates"],
  introTemplate_3day: [             // for adapting Western lifters per Perryman's recommendations
    { day:1, lifts:["snatch_daily_max","clean_jerk_daily_max","front_squat_daily_max"] },
    { day:2, off_or_speed_doubles_70_80pct: true },
    { day:3, lifts:["snatch_daily_max","clean_jerk_daily_max","front_squat_daily_max"] }
  ],
  fullTemplate_5_6day: [
    { day:"Mon", session:"snatch DM, C&J DM, front_squat DM" },
    { day:"Tue", session:"back_squat DM, snatch from blocks, push press" },
    { day:"Wed", session:"snatch DM, C&J DM, front_squat DM" },
    { day:"Thu", session:"back_squat DM, hang clean DM, jerk DM" },
    { day:"Fri", session:"competition-style snatch + C&J + front_squat DM" }
  ],
  prescriptionRule: "Each session, work up to a 'daily max' (DM) — heaviest single for the day with technically clean form. Then perform 2–4 back-off singles at 90–95% of DM."
}
```

**Algorithmic Progression Logic.** **No percentages from a stored 1RM** — every session's load is determined by what the operator can lift cleanly that day. The "daily max" is **not** a true grinding 1RM; it's a max-effort single executed without missing or breaking form. Progression emerges over weeks as DMs gradually climb. Over 4-week block:
- Weeks 1–3: standard daily max protocol
- Week 4: deload — load capped at 80% of recent DMs, volume halved

**Failure response.** If operator misses a lift, that's the day's max (or back off 5%) and move on. Do not grind; do not make multiple attempts at the same load. Bulgarian explicitly accepts misses as normal — they're feedback on neural readiness.

**Volume autoregulation.** Either time-cap sessions (e.g., 90 min) or apply Perryman's "no grinding" rule — stop when the next attempt would slow significantly.

**Integration Notes.** Advanced Olympic lifters or competitive powerlifters chasing single-lift PRs. Extremely high CNS demand and injury risk if applied with non-Olympic-style lifts (eccentric stress kills you on a daily-max bench). For Guns Up: only offer to operators with ≥ 3 yrs Olympic lifting, no recent injuries, and dedicated recovery (sleep, food). Otherwise default to Catalyst-style block programming.

---

## UNIFIED TYPESCRIPT INTERFACE PROPOSAL

To normalize all 20 templates into a single schema for the Guns Up codebase, I propose the following TypeScript interface. It captures every common dimension found across the 20 templates while allowing template-specific extensions via discriminated unions.

```typescript
// =============================================================================
// CORE ENUMS
// =============================================================================
type Population = "strength" | "hypertrophy" | "tactical" | "olympic";
type ExperienceLevel = "novice" | "intermediate" | "advanced";
type ProgressionMode =
  | "linear_session"        // GZCLP, Madcow ramp
  | "linear_weekly"         // Texas Method
  | "block_percentage"      // 5/3/1, TB Operator, Hatch, Sheiko, Smolov
  | "autoregulated_RIR"     // RP Hypertrophy
  | "autoregulated_AMRAP"   // 5/3/1
  | "daily_max"             // Bulgarian, MTI assessment-based
  | "conjugate_rotation"    // Westside
  | "double_progression";   // PPL, U/L, Arnold

type IntensityType = "pct_1RM" | "pct_TM" | "RPE" | "RIR" | "AMRAP" | "by_feel" | "rep_max";

// =============================================================================
// PRESCRIPTION SCHEMA
// =============================================================================
interface SetPrescription {
  sets: number | string;              // e.g., 5 or "3-5"
  reps: number | string;              // e.g., 5 or "8-12" or "AMRAP" or "5+"
  intensity: number | string | null;  // e.g., 0.85 (% TM) or "RIR 2" or "5RM"
  intensityType: IntensityType;
  rest_seconds?: [number, number];    // [min, max]
  tempo?: string;                     // e.g., "3010"
  notes?: string;
}

interface Exercise {
  liftId: string;                     // canonical lift slug, e.g., "back_squat"
  role: "main" | "supplemental" | "accessory" | "T1" | "T2" | "T3" | "ME" | "DE" | "RE";
  prescription: SetPrescription | SetPrescription[];
  substitutions?: string[];           // allowed swaps
}

interface Session {
  dayIndex: number;                   // 1-based within the microcycle
  sessionId?: string;                 // e.g., "Upper A", "ME Lower"
  focus: string;                      // human-readable
  exercises: Exercise[];
  conditioning?: ConditioningBlock;   // tactical/hybrid templates
}

interface ConditioningBlock {
  modality: "HIC" | "LSS" | "ruck" | "metcon" | "interval" | "easy_run" | "skill";
  prescription: string;               // e.g., "30/30 sprints × 8 rounds"
  durationMinutes?: number;
}

// =============================================================================
// PROGRESSION SCHEMA
// =============================================================================
interface ProgressionRule {
  mode: ProgressionMode;

  // For block_percentage / linear_weekly / linear_session
  trainingMaxFormula?: string;        // e.g., "0.90 * tested1RM"
  weeklyPercentageTable?: WeekScheme[]; // explicit per-week sets/reps/%
  cycleIncrement?: {                  // applied at end of each cycle
    upperBody: number;                // lb
    lowerBody: number;                // lb
    units: "lb" | "kg";
    triggerCondition?: string;        // e.g., "if AMRAP >= 5"
  };

  // For autoregulated_RIR / RP-style
  volumeLandmarks?: Record<string /*muscle*/, {MV:number; MEV:number; MAV?:number; MRV:number}>;
  setProgressionRule?: string;        // e.g., "+1 set per muscle per week"
  RIRProgression?: number[];          // e.g., [3,2,1,0]

  // For autoregulated_AMRAP
  AMRAPRule?: {
    repPRThreshold: Record<string /*lift*/, number>;  // e.g., bench: 5 (extra TM bump if AMRAP >= 5)
    extraIncrement?: {upper:number; lower:number; units:"lb"|"kg"};
  };

  // For double_progression
  doubleProgressionRange?: [number, number];   // [low, high] reps
  weightStep?: {upper:number; lower:number; units:"lb"|"kg"};

  // Failure / deload
  failureResponse: {
    trigger: string;                  // e.g., "AMRAP < min reps for 2 consecutive cycles"
    action: string;                   // e.g., "TM = 0.90 * current TM"
  };
  deload: {
    cadence: string;                  // e.g., "every 4th week" or "when MRV reached"
    prescription: string;             // e.g., "40/50/60% TM × 5"
  };
}

interface WeekScheme {
  week: number;
  sets: SetPrescription[] | string;   // either explicit or natural-language pattern
}

// =============================================================================
// TOP-LEVEL TEMPLATE INTERFACE
// =============================================================================
interface PeriodizationTemplate {
  // METADATA
  id: string;                         // slug
  displayName: string;
  author: string;
  source: string;                     // book/article citation
  population: Population;
  experienceLevel: ExperienceLevel;
  cycleWeeks: number | "indefinite";
  sessionsPerWeek: number;
  equipment: string[];
  contraindications?: string[];

  // INPUTS — what the operator must provide before instantiating
  inputs: {
    requiredMaxes?: string[];         // e.g., ["squat_1RM","bench_1RM"]
    optional?: string[];              // e.g., ["bodyweight"]
    derivedTrainingMax?: string;      // formula
  };

  // PRESCRIPTION
  microcycle: Session[];              // one week of training (template)
  mesocycle?: WeekScheme[];           // multi-week percentage table if applicable

  // ALGORITHM
  progression: ProgressionRule;

  // INTEGRATION
  integration: {
    selectionCriteria: string[];      // when to recommend this template
    prerequisites: string[];
    modifications: {
      limitedEquipment?: string;
      injury?: string;
      timeConstrained?: string;
    };
    commonMistakes: string[];
    pairWith?: string[];              // e.g., conditioning protocols
  };
}

// =============================================================================
// FULL LIBRARY TYPE
// =============================================================================
type GunsUpTemplateLibrary = PeriodizationTemplate[];
```

**Field-by-field commonality across the 20 templates:**

| Field | Universal | Notes |
|---|---|---|
| `id`, `displayName`, `author`, `source` | ✅ all 20 | Metadata |
| `population` | ✅ all 20 | 4-way enum |
| `experienceLevel` | ✅ all 20 | |
| `cycleWeeks` | ✅ all 20 (some "indefinite") | |
| `sessionsPerWeek` | ✅ all 20 | |
| `equipment` | ✅ all 20 | |
| `inputs.requiredMaxes` | ✅ 18/20 (Catalyst Beginner & Bulgarian use by-feel) | |
| `microcycle` (Session[]) | ✅ all 20 | |
| `mesocycle` percentage table | ✅ 12/20 (5/3/1, GZCLP, TM stages, TB family, Hatch, Smolov, Sheiko, Madcow) | |
| `progression.mode` | ✅ all 20 | 8-way enum |
| `progression.cycleIncrement` | ✅ 14/20 | |
| `progression.AMRAPRule` | ✅ 5/20 (5/3/1 family, GZCLP, Texas Method intensity day) | |
| `progression.RIRProgression` | ✅ 3/20 (RP, Israetel block, U/L hypertrophy) | |
| `progression.failureResponse` | ✅ all 20 | |
| `progression.deload` | ✅ all 20 | |
| `integration.selectionCriteria` | ✅ all 20 | Critical for "Gunny" template selection logic |
| `conditioning` (in Session) | ✅ 5/5 tactical templates only | |

**Implementation guidance for the Guns Up codebase.**

1. **Template hydration pattern.** Each template is stored as a static JSON object matching `PeriodizationTemplate`. When an operator selects a template, the app prompts for the `inputs.requiredMaxes`, then "hydrates" the `microcycle` by replacing `intensity` placeholders with concrete loads (rounded to nearest 2.5 / 5 lb, configurable per gym/equipment).

2. **Progression engine.** A single `progressTemplate(operatorState, template, weekCompleted)` function dispatches on `template.progression.mode`:
   - `block_percentage` → look up next week's `mesocycle[weekCompleted+1]`; at end of cycle, apply `cycleIncrement`.
   - `autoregulated_RIR` → compute target sets per muscle for next week (`week_N_sets = MEV + (N-1)`).
   - `autoregulated_AMRAP` → check stored AMRAP results; if `repPRThreshold` hit, apply `extraIncrement`.
   - `linear_session` → check session result; if all sets completed, apply `weightStep`; else advance stage.
   - `daily_max` → no scheduled load — just present session structure.
   - `conjugate_rotation` → rotate ME exercise per `rotation` rule; advance DE wave week.
   - `double_progression` → for each exercise, check if top of rep range hit; if yes, +`weightStep` and reset to bottom.

3. **Failure detection.** `evaluateSession(operatorReports, expectedPrescription)` → returns `{success, missedReps, suggestedAction}`. The action triggers `progression.failureResponse.action` (e.g., TM cut, stage advance, deload).

4. **Selection / recommendation logic ("Gunny's" template-picking).**
   ```typescript
   function recommendTemplate(operator: OperatorProfile): PeriodizationTemplate {
     // Filter by population goal first
     // Then by experience level (must match or be lower)
     // Then by sessions/week available
     // Then by equipment available
     // Then by contraindications (injuries)
     // Tiebreaker: most popular template for that profile
   }
   ```

5. **Cycle scheduling.** A single `Cycle` entity represents an operator's run of a template (start date, current week, current TMs, AMRAP history). At end of cycle, `progressTemplate` produces the next cycle's TMs and the operator can re-run, switch templates, or insert a deload week.

6. **Cross-template chaining.** Several templates explicitly chain: Sheiko #29 → #30 → #31 → #32 (16-week meet prep); MTI Hector → Johnny → Frank Church (rotating Base Fitness); TB Operator → TB Mass → TB Operator (strength/hypertrophy alternation). Chaining is encoded as a `successorTemplateId` field — Gunny prompts the operator to start the successor at end of cycle.

---

## Caveats & Editorial Notes

**Source authority hierarchy used.** Whenever original author publications conflicted with secondary sources, the original took precedence: Wendler's books and his JimWendler.com posts; K. Black's Tactical Barbell I & II; Boris Sheiko's *Powerlifting: Foundations and Methods*; Greg Everett's *Olympic Weightlifting* 3rd ed.; RP's *Scientific Principles of Hypertrophy Training*; MTI's mtntactical.com; Gayle Hatch's gaylehatch.com; Westside-barbell.com. Aggregator and calculator sites (Lift Vault, Boostcamp, Liftosaur, Stronglifts) were used to corroborate percentage tables but not as primary authority.

**Where percentages vary.** A few templates have multiple "official" percentage variants — Hatch in particular (the original 12-week version varies from the widely-circulated outlawcoach.wordpress.com PDF; Matt Bruce, a "Hatch Leader," published a slightly different template with explicit triple-max progressions). The version included is the most widely-implemented. Sheiko #29's exact week-by-week percentages are in the public Lift Vault spreadsheet and Boris Sheiko's RP-published book — both should be consulted before final implementation.

**Westside is a system, not a fixed program.** The Westside template here is the canonical "basic template" published on Westside-Barbell.com. Real Westside training adapts ME exercise rotation and DE waves continuously based on observation. The implementation should accept this as a "framework template" that can be tuned, not a rigid schedule.

**Bulgarian Method for non-Olympic lifts.** The original Abadjiev system was only for Olympic lifts (snatch, C&J, front/back squat) — lifts without a damaging eccentric. Adaptations to powerlifting (Broz, Perryman) are derivative and far higher injury risk. Recommend offering the Bulgarian template only for the snatch and C&J in Guns Up, with Front Squat and Back Squat as supplementary daily-max lifts.

**RP volume landmarks are individual.** The MEV/MAV/MRV defaults shown are RP's published averages for intermediate male lifters. Any operator running RP-style programming should be prompted for prior training response data, and Gunny should adjust landmarks ± 30% based on feedback (soreness, performance trends) over the first 1–2 mesocycles.

**Speculative future-tense claims I avoided treating as facts.** Several Smolov reviews promise "+40–100 lb on squat in 13 weeks" — this is anecdotal and selection-biased (only successful runs are reported). The data structure stores progression rules deterministically without making outcome promises.

This corpus is foundational. Final implementation should validate each template's percentage tables against the original published source PDF/book for typo-level accuracy — particularly Sheiko #29, Hatch, and Smolov base mesocycle, which are the most percentage-detail-heavy programs in the library.