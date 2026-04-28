# Bodybuilding / Hypertrophy Periodization Templates (5)

> **Source:** Periodization Template Library for "Gunny" — Guns Up AI Fitness Coach Corpus.
> Full reference (incl. unified TS interface, executive summary, editorial notes) is in `_source.md` in this directory.

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
