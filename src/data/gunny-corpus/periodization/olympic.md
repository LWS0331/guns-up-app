# Olympic Weightlifting Periodization Templates (3)

> **Source:** Periodization Template Library for "Gunny" — Guns Up AI Fitness Coach Corpus.
> Full reference (incl. unified TS interface, executive summary, editorial notes) is in `_source.md` in this directory.

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
