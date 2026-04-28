# Tactical / Military Periodization Templates (5)

> **Source:** Periodization Template Library for "Gunny" — Guns Up AI Fitness Coach Corpus.
> Full reference (incl. unified TS interface, executive summary, editorial notes) is in `_source.md` in this directory.

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
