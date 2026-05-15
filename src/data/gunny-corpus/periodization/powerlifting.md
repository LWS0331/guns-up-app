# Powerlifting / Strength Periodization Templates (7)

> **Source:** Periodization Template Library for "Gunny" — Guns Up AI Fitness Coach Corpus.
> Full reference (incl. unified TS interface, executive summary, editorial notes) is in `_source.md` in this directory.

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
