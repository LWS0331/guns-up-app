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

## SUPPLEMENTATION & ENDOGENOUS T SUPPORT (2 protocols, integrate with all 5 templates above)

> Both entries below are stack-agnostic and pair with any of templates 8–12. They reference the
> same accumulation / intensification / deload phase scaffolding the periodization templates already use.

### 13. Operator Supplement Stack — Evidence-Tiered Hypertrophy & Performance (`hypertrophy_supplement_stack`)

```typescript
{
  id: "hypertrophy_supplement_stack",
  displayName: "Operator Supplement Stack — Evidence-Tiered Hypertrophy & Performance",
  author: "Gunny (GUNS UP) — synthesized from ISSN position stands, post-2018 meta-analyses, and Examine.com evidence grades",
  source: [
    "Kreider et al. 2017 JISSN 14:18 (creatine ISSN)",
    "Antonio et al. 2021 JISSN 18:13 (creatine misconceptions)",
    "Morton et al. 2018 BJSM 52(6):376-384 (protein meta)",
    "Guest et al. 2021 JISSN 18:1 (caffeine ISSN)",
    "Trexler et al. 2015 JISSN 12:30 (beta-alanine ISSN)",
    "Grgic et al. 2021 JISSN 18:61 (sodium bicarbonate ISSN)",
    "Wilson et al. 2013 JISSN 10:6 (HMB ISSN); Rowlands & Thomson 2009 JSCR 23(3):836 (counter-meta)",
    "Wankhede et al. 2015 JISSN 12:43; Lopresti et al. 2019 Medicine 98(37):e17186 (ashwagandha)",
    "Pérez-Guisado & Jakeman 2010 JSCR 24(5):1215; Trexler et al. 2019 Sports Med 49(5):707; Vårvik et al. 2021 IJSNEM 31(4):350 (citrulline)",
    "Pilz et al. 2011 Horm Metab Res 43(3):223; Lerchbaum & Pilz 2017 JCEM 102(11):4292 (vitamin D)",
    "Smith et al. 2011 Clin Sci 121(6):267 (omega-3 MPS)",
    "Cinar et al. 2011 Biol Trace Elem Res 140(1):18 (magnesium)",
    "Naghii et al. 2011 J Trace Elem Med Biol 25(1):54 (boron)",
    "Talbott et al. 2013 JISSN 10:28; Henkel et al. 2014 Phytother Res 28(4):544 (tongkat ali)",
    "Yakubu et al. 2005 Asian J Androl 7(4):399; Yakubu et al. 2008 J Ethnopharmacol 115(2):288 (fadogia — rat data only)",
    "Isenmann et al. 2019 Arch Toxicol 93(7):1807 (ecdysterone — WADA monitoring 2020+)",
    "Crisanti et al. 2025 JISSN 22(1); Harris et al. 2024 Muscles 3(4):31 (turkesterone null)",
    "Cohen / LGC analytical work 2023-2024 (turkesterone & ecdysterone adulteration)",
    "Pokrywka et al. 2014 J Hum Kinet 41:99; Vilar Neto et al. 2025 Nutrients 17(7):1275 (tribulus null)",
    "Topo et al. 2009 RBE 7:120; Willoughby & Leutholtz 2013 Nutr Res 33(10):803; Melville et al. 2015 JISSN 12:15 (DAA)",
    "Pandit et al. 2016 Andrologia 48(5):570 (shilajit/PrimaVie)",
    "Yamadera et al. 2007 Sleep Biol Rhythms 5(2):126 (glycine)",
    "Owen et al. 2008 Nutr Neurosci 11(4):193 (L-theanine + caffeine)",
    "Zhdanova et al. 2001 JCEM 86(10):4727; Brzezinski 2005 Sleep Med Rev 9:41 (low-dose melatonin)",
    "Howatson et al. 2010 Scand J MSS 20(6):843; 2012 Eur J Nutr 51:909 (tart cherry)",
    "Vandenberghe et al. 1996 J Appl Physiol 80(2):452; Trexler & Smith-Ryan 2015 (caffeine-creatine clash debunk)",
    "Solomons & Jacob 1981 AJCN 34:475 (Zn-Fe DMT1 competition)",
    "Prajapati et al. 2025 Phytother Res doi:10.1002/ptr.70096 (12-mo KSM-66 safety)"
  ],
  population: "hypertrophy",
  experienceLevel: ["intermediate", "advanced"],
  cycleWeeks: 6,
  sessionsPerWeek: "stack-agnostic; integrates with all GUNS UP periodization templates (RP 4-Day, PPL 6-Day, Upper/Lower 4-Day, Arnold 6-Day, Israetel Scientific Block)",
  equipment: "supplement protocol — no equipment dependency",
  inputs: {
    operatorMass_kg: "required for mg/kg dosing (caffeine, NaHCO3, creatine load)",
    geneticMarkers_optional: "CYP1A2 rs762551 if available (caffeine response stratification — Guest 2018 MSSE 50(8):1570)",
    dietaryProteinIntake_g_per_kg: "baseline measurement; target 1.6–2.2 g/kg/d (Morton 2018 plateau at 1.62 g/kg)",
    bloodwork_baseline: ["25(OH)D ng/mL", "ferritin", "Mg RBC (preferred over serum)", "CBC", "CMP", "lipid panel"],
    drugTestedAthlete_bool: "if true, restrict to NSF Certified for Sport, Informed Sport, or BSCG Certified Drug Free SKUs and exclude ecdysterone (WADA Monitoring Program 2020+)",
    periodizationPhase: "accumulation | intensification | deload — drives daily stack composition"
  },
  evidenceTiers: {
    A: "ISSN position stand or multiple high-quality meta-analyses converge on benefit",
    B: "consistent positive RCTs, limited meta-analytic depth or context-dependent effect",
    C: "mixed/preliminary human evidence, mechanistic plausibility",
    D: "animal-only, null in humans, or substantial quality/adulteration concerns"
  },
  prescriptionPerSession: {
    tier1_strongEvidence: {
      creatineMonohydrate: {
        evidence: "A",
        loadingProtocol: "optional 20–25 g/d (~0.3 g/kg) split 4× × 5–7 d → maintenance 3–5 g/d",
        steadyStateProtocol: "3–5 g/d from outset; saturation in ~28 d",
        timing: "any time; co-ingestion with carbs/insulin enhances retention but not required",
        mechanism: "intramuscular phosphocreatine ↑20–40%; ATP resynthesis acceleration; secondary mTOR/satellite-cell signaling",
        effectSize: "≈8% greater 1RM vs placebo + RT; +1–2 kg LBM over 4–12 wk (Kreider 2017)",
        nonResponderRate: "20–30% (high baseline muscle Cr; vegetarians have largest response)",
        formComparison: "creatine HCl vs monohydrate: no superiority demonstrated (de França 2025 PMC12291177); claims of HCl superiority unfounded",
        contraindications: "none established in healthy populations; clinical judgment in pre-existing renal disease",
        thirdPartyTesting: "Creapure® (AlzChem) is the de facto verified standard; preferred SKU"
      },
      protein: {
        evidence: "A",
        totalDailyTarget_g_per_kg: "1.6–2.2 (Morton 2018 plateau at 1.62 g/kg, 95% CI 1.03–2.20)",
        perMealDose_g_per_kg: "0.24 young / 0.40 older to maximize MPS",
        leucineThreshold_g: "2.5–3 per bolus",
        distribution: "4 evenly spaced feedings of ~0.4 g/kg (Mamerow 2014; Areta 2013)",
        sourceComparison: "whey acutely > casein for MPS (faster leucinemia); casein > whey overnight; plant proteins equivalent if total/leucine matched (Pinckaers 2024)",
        timing: "anabolic window largely defunct; total daily intake and per-meal leucine dominate",
        contraindications: "pre-existing renal failure; lactose intolerance → use isolate/hydrolysate",
        thirdPartyTesting: "NSF Certified for Sport / Informed Sport mandatory category (heavy-metal & label-accuracy contamination history)"
      },
      caffeine: {
        evidence: "A",
        dose_mg_per_kg: "3–6 (>9 mg/kg yields no additional benefit, more side effects)",
        timing: "30–60 min pre; caffeine gum peaks ~10 min",
        cyp1a2Stratification: "rs762551 AA (fast metabolizers) +4.8% at 2 mg/kg, +6.8% at 4 mg/kg; CC genotype impaired performance −13.7% at 4 mg/kg (Guest 2018 MSSE)",
        cyclingProtocol: "1–2 wk full washout every 8–12 wk to restore receptor sensitivity; mandatory in deload week",
        mechanism: "adenosine A1/A2A antagonism; reduced perceived effort; motor unit recruitment ↑",
        effectSize: "endurance ~2–4%; strength/power small-to-moderate (Grgic meta)",
        contraindications: "anxiety disorders, arrhythmias, late-day dosing, pregnancy >200 mg/d"
      },
      betaAlanine: {
        evidence: "A",
        dose_g_per_day: "4–6 (some texts 3.2–6.4); split into ≤1.6 g doses to minimize paresthesia",
        loadingDuration_weeks: "≥2–4; carnosine ↑~64% at 6.4 g/d × 4 wk",
        maintenance_g_per_day: "1.2",
        mechanism: "rate-limiting carnosine precursor → intramuscular H+ buffering",
        effectWindow_seconds: "60–240 (open-end-point glycolytic tasks); trivial <60s or >240s; no clear hypertrophy benefit",
        meanErgogenicEffect: "≈2.85% (Hobson 2012 meta)",
        thirdPartyTesting: "CarnoSyn® is the patented studied form; widely Informed Sport listed"
      },
      citrullineMalate: {
        evidence: "B",
        doseCM_g: "8 (2:1 malate ratio), 60 min pre",
        doseLCitrulline_g: "3–6 (some literature ≥10–15 g per Moinard 2008 PK)",
        mechanism: "bypasses hepatic first-pass; raises plasma arginine > oral arginine; NO synthesis ↑; malate as TCA intermediate; urea-cycle ammonia clearance",
        effectSize: "+52.9% bench reps final set (Pérez-Guisado 2010); +21% leg-press reps women (Glenn 2017); pooled SMD ≈0.19 reps-to-failure (Vårvik 2021)",
        contraindications: "GI discomfort ~14.6%; PDE5 inhibitor stacking caution (additive vasodilation)"
      }
    },
    tier2_moderateEvidence: {
      vitaminD3: {
        evidence: "B (deficient) / C (replete)",
        dose_IU_per_day: "2,000–5,000; titrate to serum 25(OH)D 40–60 ng/mL",
        deficiencyCutoff_ng_per_mL: "<30 (Endocrine Society)",
        effectSize: "+25.2% total T in deficient men over 12 mo (Pilz 2011); null in replete men (Lerchbaum 2017 JCEM 102:4292)",
        mechanism: "VDR in Leydig cells, hypothalamus; supports steroidogenesis when deficient",
        contraindications: "hypercalcemia, sarcoidosis, primary hyperparathyroidism; UL 4,000 IU/d (IOM)"
      },
      omega3_EPA_DHA: {
        evidence: "B",
        dose_g_per_day: "2–3 combined; EPA-dominant (≥2 g EPA) for muscle",
        mechanism: "phospholipid incorporation → mTOR/p70S6K sensitization; SPM-mediated inflammation resolution; ↓MuRF-1, ↓atrogin-1",
        effectStrongestIn: "older adults, clinical populations, disuse atrophy (McGlory 2019 FASEB J)",
        contraindications: "anticoagulant stacking >3 g/d (additive bleeding risk); fish allergy",
        thirdPartyTesting: "IFOS / Informed Sport for purity & oxidation state"
      },
      magnesium: {
        evidence: "C performance / B deficiency correction",
        dose_mg_per_day: "200–400 elemental; UL supplemental 350 mg/d (NIH)",
        formPreference: "glycinate > citrate > malate >> oxide (oxide poorly absorbed, GI distress)",
        useCase: "primarily sleep architecture & recovery; correct deficiency",
        mechanism: "300+ enzyme cofactor; NMDA antagonism (sleep); SHBG modulation",
        contraindications: "renal impairment; diarrhea with citrate/oxide at higher doses"
      },
      zinc: {
        evidence: "C",
        dose_mg_per_day: "15–30 elemental; UL 40",
        useCase: "deficiency correction in heavy-sweat athletes; not a T-booster in replete men",
        ZMA_evidence: "Brilla & Conte 2000 positive (industry-funded); Wilborn 2004 JISSN 1(2):12 null in replete trained men",
        contraindications: "chronic high-dose → copper deficiency, anemia",
        stackInteraction: "Zn–Fe DMT1 competition (Solomons & Jacob 1981 AJCN); separate by ≥2 h"
      },
      HMB: {
        evidence: "C untrained / D trained",
        dose_g_per_day: "3 (1 g × 3) — HMB-FA & HMB-Ca equivalent on outcomes despite PK differences",
        useCase: "untrained, catabolic states, elderly, return-from-injury — NOT trained operators",
        nullInTrained: "Rowlands & Thomson 2009 JSCR 23(3):836 meta; Sanchez-Martinez 2018 JSAMS; Jakubowski 2020 Sports Med — null on TBM, FFM, FM, 1RM in trained",
        mechanism: "leucine metabolite; ↓ubiquitin-proteasome breakdown; modest MPS support"
      },
      ashwagandhaKSM66: {
        evidence: "B",
        dose_mg_per_day: "300–600 (KSM-66 5% withanolides) or 125–250 (Sensoril 10% withanolides)",
        cyclingProtocol: "8–12 wk on / 2–4 wk off (precautionary, not based on demonstrated tachyphylaxis)",
        effectSize: "T +96.2 ng/dL vs +18.0 placebo; bench +46 kg vs +26.4 (Wankhede 2015); cortisol −22%, T +14.7% (Lopresti 2019)",
        mechanism: "HPA modulation, cortisol ↓; GABAergic; antioxidant",
        contraindications: "autoimmune disease (theoretical), hyperthyroidism (modest T3/T4 ↑), pregnancy, sedative interactions; rare hepatotoxicity case reports (Suryawanshi 2022)",
        longTermSafety: "12-mo RCT at 600 mg/d KSM-66 — no clinically significant AEs (Prajapati 2025 Phytother Res)",
        thirdPartyTesting: "specify KSM-66 (Ixoreal) or Sensoril (Natreon) — generic ashwagandha withanolide content varies wildly"
      },
      sodiumBicarbonate: {
        evidence: "A efficacy / strong GI caveat",
        dose_g_per_kg: "0.3 ingested 60–180 min pre; 0.4–0.5 g/kg = no further benefit, more GI distress",
        multiDayProtocol: "0.4–0.5 g/kg/d split × 3–7 d",
        effectWindow_seconds: "30–720 (sprint/combat/rowing)",
        meanEffect: "+1.7% sprint performance (Carr 2011 Sports Med 41:801)",
        GIMitigation: "enteric-coated (Maurten Bicarb System), gradual loading, ingest with carb meal",
        applicabilityInHypertrophy: "marginal — primarily for high-volume, short-rest, glycolytic protocols (drop sets, rest-pause clusters)"
      }
    },
    tier3_emerging_contested: {
      tongkatAli: {
        evidence: "C",
        dose_mg_per_day: "200–400 standardized aqueous root extract (Physta®, LJ100®)",
        cyclingProtocol: "8 wk on / 2 wk off (precautionary)",
        effectStrongestIn: "stressed, hypogonadal, aging men; modest in healthy young trained",
        effectSize: "salivary T +37%, cortisol −16% in moderately stressed (Talbott 2013, n=63 × 4 wk)",
        mechanism: "quassinoids (eurycomanone) — aromatase inhibition, ↑steroidogenesis, ↓SHBG",
        contraindications: "hormone-sensitive cancers, prostate concerns; insomnia at high doses"
      },
      fadogiaAgrestis: {
        evidence: "D",
        humanRCTs: "NONE published",
        animalData: "Yakubu 2005, 2008 — rat T ↑ up to 6× at 100 mg/kg; testicular toxicity, hepato-/nephrotoxicity at higher 28-d exposure",
        marketDose_mg: "600 (no human PK or safety data)",
        recommendation: "DO NOT include in protocol. Popularized by Huberman/Attia; entirely extrapolated from rat data using flawed allometric scaling. Testicular toxicity signal is the deal-breaker."
      },
      turkesterone: {
        evidence: "D",
        humanRCTs: "Crisanti 2025 JISSN 22(1) and Harris 2024 Muscles 3(4):31 — null on body comp, strength, IGF-1, RMR",
        qualityIssues: "Cohen / LGC 2023-2024 — substantial label-vs-actual content mismatch; some products contain ~6 mg vs declared 100 mg; many adulterated",
        recommendation: "DO NOT recommend. Mechanistic plausibility (ERβ agonism) ≠ outcome data."
      },
      ecdysterone: {
        evidence: "C with WADA caveat",
        keyTrial: "Isenmann 2019 Arch Toxicol 93(7):1807 — German Sport University Cologne, 10 wk RT, n=46 men: significantly greater 1RM bench & lean mass; authors recommended WADA inclusion",
        wadaStatus: "Monitoring Program 2020+ (not prohibited but surveilled)",
        adulterationRisk: "actual content frequently far below label",
        recommendation: "AVOID for any drug-tested athlete. For non-tested operators: optional, but quality-control risk is high."
      },
      boron: {
        evidence: "C",
        dose_mg_per_day: "6–10; UL 20 mg/d (IOM)",
        keyTrial: "Naghii 2011 JTEMB 25:54 — 10 mg/d × 7 d, n=8: free T +28%, E2 −39%, hsCRP −50%; total T not significantly changed",
        sampleSizeCaveat: "n=8, no placebo arm in pre/post; replication limited",
        mechanism: "inhibits microsomal hydroxylation of steroids; ↓SHBG; vitamin D synergy (Pizzorno 2015)",
        utility: "low-risk, low-cost adjunct; do not over-attribute"
      },
      tribulusTerrestris: {
        evidence: "D (null for T)",
        keyMeta: "Pokrywka 2014 J Hum Kinet 41:99; Qureshi 2014 J Diet Suppl 11:64; Vilar Neto 2025 Nutrients 17(7):1275 — 8/10 studies null",
        recommendation: "DO NOT include. Marketing >> evidence. AIS Category D (contamination risk for banned substances)."
      },
      DAA_dAsparticAcid: {
        evidence: "D in trained",
        dose_g_per_day: "3 typical",
        keyTrials: "Topo 2009 RBE 7:120 +42% T in sedentary IVF men with low baseline; Willoughby 2013 Nutr Res 33:803 NULL in trained at 3 g; Melville 2015 JISSN 12:15 — 6 g/d DECREASED T; 3 g/d no effect",
        recommendation: "DO NOT include for trained operators. Useful only in subfertile / low-baseline men, and even then evidence is weak."
      },
      mucunaPruriens: {
        evidence: "C fertility / D athletic hypertrophy",
        dose: "150–300 mg standardized to ≥15% L-DOPA, OR 5 g raw seed powder",
        useCase: "prolactin-driven HPG suppression or fertility; not a hypertrophy primary",
        mechanism: "L-DOPA → dopamine → ↑GH/LH, ↓prolactin"
      },
      shilajit: {
        evidence: "B in 45–55 y men / C broader",
        dose_mg_per_day: "250–500 PrimaVie® (≥50% fulvic acid, 0.3% dibenzo-α-pyrones), often BID",
        keyTrial: "Pandit 2016 Andrologia 48(5):570 — 250 mg BID × 90 d in men 45–55: total T +20.45%, free T +19.14%, DHEA-S +31.35%",
        contraindication: "heavy-metal contamination in unpurified products — only use standardized/purified extracts",
        utility: "secondary T-support consideration for older operators; not a Tier 1 hypertrophy lever"
      }
    },
    recoverySleepStack: {
      magnesiumGlycinate: {
        evidence: "C performance / B deficiency",
        dose_mg: "200–400 elemental, 30–60 min pre-bed",
        rationale: "modest sleep-quality improvement in deficient/older adults (Mah 2021 meta); muscle relaxation"
      },
      glycine: {
        evidence: "B",
        dose_g: "3 pre-bed",
        keyTrial: "Yamadera 2007 — improved subjective sleep quality, shortened sleep onset latency, ↓daytime sleepiness, improved next-day memory",
        mechanism: "NMDA-mediated peripheral vasodilation → ↓core body temperature (Kawai 2015)",
        safety: "GI tolerability up to 9 g acute"
      },
      apigenin: {
        evidence: "C/D (hyped beyond evidence)",
        markedDose_mg: "50",
        evidenceCaveat: "NO isolated-apigenin RCT for sleep at 50 mg. All effects extrapolated from chamomile extract trials (Zick 2011 BMC CAM 11:78 — trend only on daytime function; no significant effect on TST, sleep efficiency, latency, WASO). Mechanism plausible (partial GABA-A agonism, CD38 inhibition); human evidence for the Huberman protocol is essentially anecdotal.",
        recommendation: "optional; do not anchor stack on it"
      },
      lTheanine: {
        evidence: "B (cognition)",
        dose_mg: "100–200 with caffeine; ratio ~1:2 caffeine:theanine",
        keyTrial: "Owen 2008 Nutr Neurosci 11(4):193 — 50 mg caf + 100 mg theanine: improved attention switching, ↓distraction susceptibility",
        mechanism: "↑alpha-wave activity, glutamate antagonism at NMDA, modest GABA/dopamine ↑; smooths caffeine arousal curve"
      },
      melatonin: {
        evidence: "A circadian / B insomnia",
        dose_mg: "0.3–0.5 (physiological) — NOT 3–10 mg",
        keyTrial: "Zhdanova 2001 JCEM 86:4727 — 0.3 mg restored physiologic serum levels & improved sleep efficiency in older adults; 3 mg also improved sleep but caused hypothermia and elevated daytime melatonin (residual hangover)",
        plateauEffect: "Brzezinski 2005 Sleep Med Rev 9:41 — efficacy plateaus at ~0.3 mg; higher doses add side effects without efficacy",
        useCase: "circadian phase-shifting (jet lag, DSPS, shift work), not chronic sleep aid",
        qualityCaveat: "Erland & Saxena 2017 JCSM — labeled vs actual content varied −83% to +478% in commercial US melatonin"
      },
      tartCherry: {
        evidence: "B",
        dose: "480 mL juice or 1 oz Montmorency concentrate BID, OR 480 mg powdered extract",
        protocol: "4–7 d pre + 2 d post strenuous bout",
        keyTrial: "Howatson 2010 Scand J MSS — faster strength recovery, ↓CK, ↓IL-6, ↓CRP post-marathon; Howatson 2012 Eur J Nutr — ↑urinary 6-sulfatoxymelatonin, improved sleep",
        mechanism: "anthocyanins (cyanidin glycosides) → COX inhibition, antioxidant; native melatonin content"
      }
    }
  },
  periodizationPhaseDosing: {
    accumulation_weeks_1_to_4: {
      objective: "build volume tolerance; full recovery support",
      tier1_daily: "creatine 3–5 g, protein 1.6–2.2 g/kg, beta-alanine 4–6 g (if on cycle), citrulline malate 8 g pre-workout 4–6×/wk",
      caffeine: "3–6 mg/kg pre key sessions; full days off on rest days",
      tier2_daily: "vitamin D3 to target 25(OH)D 40–60 ng/mL, omega-3 2–3 g, magnesium 200–400 mg PM",
      adaptogens: "ashwagandha KSM-66 600 mg PM if on cycle; tongkat ali 200–400 mg AM if on cycle",
      sleepStack: "glycine 3 g pre-bed; tart cherry not yet (reserve for intensification/deload)"
    },
    intensification_week_5: {
      objective: "maximize ergogenics; creatine fully saturated; recovery emphasis",
      tier1_daily: "creatine 3–5 g (saturated since wk 1), protein push to 2.0–2.2 g/kg, citrulline malate 8 g pre-workout every session, beta-alanine 4–6 g",
      caffeine: "3–6 mg/kg pre every session — peak ergogenic week",
      addedSupport: "tart cherry 480 mg BID across wk 5–6 (recovery); sodium bicarbonate 0.3 g/kg pre-session ONLY for high-volume short-rest glycolytic protocols (drop sets, myo-reps, rest-pause)",
      sleepStack: "glycine 3 g + magnesium glycinate 400 mg pre-bed mandatory; assess whether ashwagandha is helping cortisol — labs optional"
    },
    deload_week_6: {
      objective: "parasympathetic dominance; receptor sensitivity restoration; micronutrient repletion",
      caffeineProtocol: "STRIP STIMULANTS — 1 wk full caffeine washout (re-sensitize adenosine receptors)",
      maintained: "creatine 3–5 g (does not detrain), protein 1.6 g/kg minimum, vitamin D, omega-3, magnesium, zinc",
      withdrawn: "citrulline malate (no need without ergogenic demand), beta-alanine optional taper, NaHCO3, ashwagandha optional washout if on 8-wk-on/2-wk-off cycle",
      sleepStack: "double down — glycine 3 g + magnesium glycinate 400 mg + tart cherry; consider low-dose melatonin 0.3–0.5 mg only if circadian disruption"
    },
    cycleToCycleProtocols: {
      caffeine: "1–2 wk full washout every 8–12 wk",
      ashwagandha: "8–12 wk on / 2–4 wk off",
      tongkatAli: "8 wk on / 2 wk off",
      betaAlanine: "continuous loading + maintenance; optional 8–12 wk on / 4 wk off",
      creatine: "continuous — no cycling indicated (Kreider 2017)",
      melatonin: "as-needed only; avoid chronic high-dose",
      doNotCycle: "protein, vitamin D, omega-3, magnesium, zinc — these are nutritional repletion, not ergogenics"
    }
  },
  stackInteractions: {
    caffeineCreatineMyth: "Largely debunked. Vandenberghe 1996 J Appl Physiol 80:452 had insufficient washout & withdrawal artifacts. Trexler & Smith-Ryan 2015 review and Marques 2022 IJSNEM 32:285 confirm safe co-ingestion. If GI issues, separate by 30–60 min.",
    zincIron: "Compete for DMT1 in duodenum (Solomons & Jacob 1981 AJCN 34:475). Separate by ≥2 h. Iron AM empty stomach + vitamin C; zinc PM with food.",
    boronVitaminD: "Synergistic — boron supports 25(OH)D activation and half-life (Pizzorno 2015 IM)",
    omega3Anticoagulants: "Additive bleeding risk at >3 g/d combined EPA+DHA",
    citrullinePDE5: "Additive vasodilation with PDE5 inhibitors; flag for medical review",
    ashwagandhaSedatives: "Theoretical CNS depressant additivity (benzodiazepines, alcohol)"
  },
  thirdPartyTestingTier: {
    mandatoryForDrugTestedAthletes: ["NSF Certified for Sport (NFL/MLB/NHL/PGA/LPGA/CFL recognized)", "Informed Sport (UFC/USADA, EIS, batch-by-batch testing, preferred for international/Olympic)", "BSCG Certified Drug Free (Catlin family, broadest scope: 485 drugs)"],
    proteinPriority: "non-negotiable — heavy-metal & label-accuracy contamination history",
    creatinePriority: "Creapure® (AlzChem) — de facto standard; many Creapure SKUs carry NSF or Informed Sport",
    avoidProprietaryBlends: "concealed dosing precludes verification; common in pre-workouts"
  },
  bloodworkTracking: ["25(OH)D q6mo until in 40–60 ng/mL range, then annually", "ferritin & iron sat baseline + annually", "Mg RBC (preferred over serum) baseline + as needed", "lipid panel + CMP annually", "CBC if on iron or any chronic supp", "PSA baseline if >40 y or on tongkat/ashwagandha long-term"]
}
```

#### Stack logic

Total daily stack composition is **driven by mesocycle phase, not by marketing**. Tier 1 ergogenics (creatine, protein, beta-alanine, caffeine, citrulline) form the chassis across accumulation and intensification because they have ISSN position-stand backing and meta-analytic support. Tier 2 nutritional repletion (vitamin D, omega-3, magnesium, zinc) operates continuously as a deficiency-correction baseline — these are not ergogenics, they are floor maintenance. Tier 3 botanicals (ashwagandha, tongkat ali, shilajit) layer on for stress-context T support in cycles synchronized with the 6-week mesocycle.

**Caffeine is the only ergogenic that mandates a deload washout.** Creatine does not detrain (saturation persists ~4–5 weeks post-cessation; Kreider 2017). Beta-alanine carnosine has even longer washout (~15-week half-life; Stellingwerff 2010). Withdrawing creatine or beta-alanine during deload yields no benefit and re-introduces a re-saturation cost. Caffeine, by contrast, drives adenosine receptor upregulation with chronic use and benefits from a 7–14 day full washout to restore sensitivity ahead of the next accumulation block.

**The Tier 3 botanicals are graded honestly.** Ashwagandha KSM-66 at 600 mg/d has the strongest RCT base of any T-relevant adaptogen (Wankhede 2015 +96 ng/dL T vs +18 placebo, Lopresti 2019 +14.7% T). Tongkat ali Physta® at 200–400 mg has moderate evidence in stressed/aging populations. Shilajit PrimaVie® at 250 mg BID has Pandit 2016 backing in 45–55 y men. Beyond these three, the evidence collapses: **fadogia agrestis is rat-only with a documented testicular toxicity signal at 28-day exposure and zero published human RCTs** — the protocol does not include it. **Turkesterone has two recent null RCTs (Crisanti 2025, Harris 2024) and major adulteration evidence from LGC analytical work** — the protocol does not include it. **Ecdysterone is on the WADA Monitoring Program 2020+** — the protocol excludes it for any drug-tested operator. **Tribulus, DAA, and high-dose mucuna are null or marginal** in trained men — excluded from the standing stack.

Caffeine genotype stratification matters where data is available. CYP1A2 rs762551 AA homozygotes ("fast metabolizers") show +6.8% endurance performance at 4 mg/kg; CC genotype shows performance *impairment* of −13.7% at the same dose (Guest 2018 MSSE 50:1570). Operators with CC genotype should cap caffeine at 2 mg/kg or substitute non-stimulant pre-workout (citrulline + carbs + electrolytes).

#### Adverse response signals

Stop or reduce dose if: GI distress >24 h on creatine load (drop loading; go straight to 3–5 g maintenance); paresthesia intolerable on beta-alanine (split to ≤0.8 g doses or use sustained-release); resting HR sustained +10 bpm or sleep onset latency >45 min on caffeine (washout 7–14 d, restart at 2 mg/kg); LFTs (ALT/AST) elevated >2× ULN on ashwagandha (rare but documented; Suryawanshi 2022 — discontinue); persistent insomnia or anxiety on tongkat ali (reduce to 100 mg AM or discontinue); GI distress >30% sessions on sodium bicarbonate (switch to enteric-coated or discontinue); hematocrit >52% on any T-support stack (medical review). **Hard stop signals**: jaundice, RUQ pain, dark urine, palpitations, syncope — discontinue all non-essentials and seek clinical evaluation.

#### Integration notes

Stack integrates with all five GUNS UP periodization templates without modification. **RP Hypertrophy 4-Day and Israetel Scientific Block** map directly to the accumulation/intensification/deload phase dosing because they are 6-week mesocycles with explicit MEV→MAV→MRV progression and a defined deload week. **PPL 6-Day and Arnold Split 6-Day** apply the same phase logic; the higher session frequency raises the importance of citrulline malate and tart cherry during intensification weeks because of compressed inter-session recovery. **Upper/Lower 4-Day** uses identical Tier 1 chassis with a smaller intensification spike (lower weekly volume → less acute ergogenic need).

Operator population fit: tactical operators benefit most from the recovery/sleep stack (glycine, magnesium glycinate, tart cherry on heavy weeks) given chronic sleep debt and mission-driven cortisol. Aesthetic operators in cutting phases should preserve all Tier 1 supplements but reduce sodium bicarbonate (water retention concerns near peak). Operators >35 y see the largest ROI on the Tier 2/3 hormonal-support layer (ashwagandha, vitamin D titration, optional shilajit) because age-related Leydig decline is documentable from ~30 y onward (Harman 2001 BLSA, ~1%/yr total T, ~2%/yr free T).

Stack is designed to be drug-test compliant if all SKUs carry NSF Certified for Sport, Informed Sport, or BSCG Certified Drug Free marks and ecdysterone is excluded. Operators in sport-tested federations should additionally avoid all Tier 3 botanicals during the in-competition period until WADA monitoring outcomes are finalized.

---

### 14. Natural Testosterone Optimization Protocol — Sleep, Train, Eat, Live (`natural_test_optimization_protocol`)

```typescript
{
  id: "natural_test_optimization_protocol",
  displayName: "Natural Testosterone Optimization Protocol — Sleep, Train, Eat, Live",
  author: "Gunny (GUNS UP) — synthesized from Endocrine Society 2018, AUA 2018/2024 guidelines, and post-2018 meta-analyses",
  source: [
    "Bhasin et al. 2018 JCEM 103(5):1715-1744 (Endocrine Society)",
    "Mulhall et al. 2018 J Urol 200(2):423-432 (AUA, updated 2024)",
    "Leproult & Van Cauter 2011 JAMA 305(21):2173-2174",
    "Wittert 2014 Asian J Androl 16(2):262-265 / Curr Opin Endocrinol 21(3):239-243",
    "Cignarelli 2019 Front Endocrinol 10:551 (CPAP T meta — null)",
    "Harman et al. 2001 JCEM 86(2):724-731 (BLSA)",
    "Travison et al. 2007 JCEM 92(1):196-202",
    "Kraemer & Ratamess 2005 Sports Med 35(4):339-361 (acute hormones)",
    "West & Phillips 2012 Eur J Appl Physiol 112(7):2693-2702",
    "West et al. 2010 J Appl Physiol 108(1):60-67",
    "Schoenfeld 2013 J Strength Cond Res 27(6):1720-1730",
    "Kvorning et al. 2006 Am J Physiol Endocrinol Metab 291:E1325-E1332",
    "Hackney 2005 Acta Physiol Hung 92(2):121-137 (EHMC)",
    "Hickson 1980 Eur J Appl Physiol 45:255-263; Wilson et al. 2012 JSCR 26(8):2293-2307 (concurrent meta)",
    "Friedl 2000 / Pasiakos 2014 JCEM 99:956 (Ranger studies)",
    "Hämäläinen et al. 1984 J Steroid Biochem 20(1):459-464",
    "Whittaker & Wu 2021 J Steroid Biochem Mol Biol 210:105878 (low-fat → low T meta)",
    "Volek et al. 1997 J Appl Physiol 82(1):49-54",
    "Corona et al. 2013 Eur J Endocrinol 168(6):829-843 (weight loss & T meta)",
    "Cohen 1999 Med Hypotheses 52(1):49-51 (hypogonadal-obesity cycle)",
    "Prasad 1996 Nutrition 12(5):344-348",
    "Cinar et al. 2011 Biol Trace Elem Res 140(1):18-23",
    "Pilz et al. 2011 Horm Metab Res 43(3):223-225; Lerchbaum & Pilz 2017 JCEM 102(11):4292-4302",
    "Naghii et al. 2011 J Trace Elem Med Biol 25(1):54-58",
    "Wankhede et al. 2015 JISSN 12:43; Lopresti et al. 2019 Medicine 98(37):e17186; Ambiye 2013 EBCAM 2013:571420",
    "Talbott et al. 2013 JISSN 10:28",
    "Yakubu et al. 2008 J Ethnopharmacol 115(2):288-292",
    "Moro et al. 2016 J Transl Med 14:290 (TRE T drop)",
    "Sarkola & Eriksson 2003 Alcohol Clin Exp Res 27(4):682-685",
    "Emanuele & Emanuele 1998 Alcohol Health Res World 22(3):195-201",
    "Meeker & Ferguson 2014 JCEM 99(11):4346-4352 (NHANES phthalate-T)",
    "Hayes et al. 2002 PNAS 99(8):5476-5480; 2010 PNAS 107:4612-4617 (atrazine)",
    "Wang et al. 1997 Fertil Steril 68(2):334-339; Mínguez-Alarcón 2018 Hum Reprod 33(9):1749-1756 (scrotal heat & boxers/briefs)",
    "Pilch et al. 2013 J Hum Kinet 39:127-135 (sauna)"
  ],
  population: "hypertrophy",
  experienceLevel: ["intermediate", "advanced"],
  cycleWeeks: 6,
  sessionsPerWeek: "protocol-agnostic; integrates with all GUNS UP periodization templates",
  equipment: "lifestyle protocol — no equipment",
  inputs: {
    operatorAge: "drives age-related decline expectations (Harman 2001 — total T −1%/yr, free T −2%/yr after 30)",
    operatorBodyFat_pct: "target window 10–18% (operator heuristic, not RCT-defined; both extremes suppress T)",
    sleepHours_baseline: "current average — target 7–9 h with intact architecture",
    trainingLoad_weekly: "volume + endurance interference assessment",
    bloodwork_baseline: "full panel (see bloodworkPanel field below)",
    periodizationPhase: "accumulation | intensification | deload — drives T-support emphasis"
  },
  pillars: {
    sleep: {
      target: "7–9 h with ≥3 h consolidated sleep with normal architecture (Wittert 2014 — T pulse is sleep-dependent, not strictly circadian)",
      keyEvidence: {
        leproult2011: "JAMA 305:2173 — 8 nights × <5 h TIB → daytime T −10–15% in young men",
        suMeta2022: "total sleep deprivation ≥24 h SMD −0.64; partial restriction non-significant pooled",
        wittertReview: "after adjusting for adiposity, OSA itself does not appear to lower T; the link is mediated by obesity",
        cpapMeta: "Cignarelli 2019 Front Endocrinol — pooled CPAP across 12 studies, n=388: NULL effect on total T, free T, SHBG. Weight loss restores T in OSA, not CPAP per se."
      },
      hygieneProtocol: ["bedroom 65–68°F", "blackout to <1 lux", "no screens 90 min pre-bed (or red-light glasses)", "consistent sleep/wake ±30 min", "morning sun exposure 10–30 min within 60 min of waking (Huberman protocol — circadian entrainment; direct T evidence weak but mechanism supports HPG entrainment)", "caffeine cutoff 8–10 h pre-bed"],
      olderOperators: "screen for OSA via STOP-BANG; refer for polysomnography if score ≥3 — but understand that CPAP alone does not raise T; weight loss is the primary lever"
    },
    training: {
      acuteVsChronic: {
        acuteTSpike: "heavy compounds (squat, deadlift, press) with 10RM × multi-set × short rest produce largest acute T spike (Kraemer 1990 J Appl Physiol 69:1442; Vingren/Kraemer 2010 Sports Med 40:1037)",
        chronicTransfer: "DEBUNKED. West & Phillips 2012 Eur J Appl Physiol 112:2693 — 12 wk RT in 56 young men: NO correlation between acute post-exercise T/GH/IGF-1 AUC and gains in LBM, fiber CSA, or strength. West 2010 J Appl Physiol 108:60 — same-mover protocols with 5–10× T spike difference produced equivalent hypertrophy. Schoenfeld 2013 JSCR 27:1720 — mechanical tension dominant, not transient hormones.",
        baselineMatters: "Kvorning 2006 Am J Physiol Endocrinol Metab 291:E1325 — GnRH suppression (goserelin) during 8-wk RT attenuates strength/lean-mass gains. Chronic baseline T does matter; transient post-set spikes do not."
      },
      overtrainingSuppression: "Fry & Kraemer 1997-1998 — high-intensity RT overtraining → blunted T, ↑cortisol, ↓T:C. Functional overreaching is fine; non-functional overreaching → T suppression",
      concurrentTrainingInterference: "Hickson 1980 + Wilson 2012 meta JSCR 26:2293 — endurance modality and volume drive interference. Running > cycling for interference. Cap concurrent endurance at 2–3 sessions/wk and ≤45 min if hypertrophy is primary",
      EHMC: "Hackney 2005 — chronic high-volume endurance (e.g., 100–200 km/wk running for years) produces persistent low T without compensatory LH rise. Hypertrophy-primary operators should NOT chase ultra-endurance volume",
      HIITvsLISS: "limited direct head-to-head T data; acute HIIT raises T transiently; no conclusive chronic difference. LISS at moderate volumes does not suppress T",
      detraining: "brief (1–2 wk) detraining does not crash T in healthy men; Kvorning data confirm chronic baseline T responds to chronic training stimulus",
      protocolGuidance: "lift heavy compounds 3–6×/wk for mechanical tension; cap weekly endurance volume to avoid concurrent interference and EHMC; ensure ≥48 h between heavy lower-body sessions for HPG recovery"
    },
    nutrition: {
      energyAvailability: {
        rangerStudy: "Friedl 2000 / Pasiakos 2014 JCEM 99:956 — 8-wk Army Ranger (severe deficit + sleep dep + heavy exertion): total T fell 50–70%, IGF-1 −38.7%, SHBG +46%",
        thresholdEstimate: "low-energy availability <25 kcal/kg FFM/d; clinically problematic <15 kcal/kg FFM/d (Koehler 2016 J Sports Sci 34:1921)",
        obeseSubpopulationException: "VLCD in obese men (Schulte 2014 Horm Metab Res 46:283) — total T 6.97 → 13.21 nmol/L; opposite effect because aromatization in adipose drops",
        weightLossMeta: "Corona 2013 Eur J Endocrinol 168:829 — lifestyle weight loss → +2.87 nmol/L total T; bariatric → +8.73 nmol/L; linear with weight-loss percentage"
      },
      bodyFatRange: {
        operatorHeuristic: "10–18% body fat for natural T optimization",
        evidenceCaveat: "no RCT defines a precise 10–15% threshold. Travison 2007 JCEM 92:196 confirms continuous inverse BMI–T relationship; Pardue 2017 case study — natural bodybuilder lost 72% T during contest prep at <8% BF and low EA. Both extremes (severe leanness + obesity) suppress T via different mechanisms",
        aromatizationMechanism: "Cohen 1999 Med Hypotheses 52:49 — adipose aromatase converts T → E2 → ↓LH → ↓T → ↑visceral adiposity (self-reinforcing cycle)"
      },
      macros: {
        dietaryFat_pct_kcal: "20–35% (Whittaker & Wu 2021 J Steroid Biochem Mol Biol 210:105878 meta — low-fat diets reduce total T by ~57 ng/dL vs higher-fat; effect strongest in Western men)",
        keyTrial: "Hämäläinen 1984 — 40% fat → 25% fat for 6 wk dropped total T 22.7 → 19.3 nmol/L (p<0.001), free T 0.23 → 0.20 nmol/L. Reversible.",
        MUFA_emphasis: "Volek 1997 J Appl Physiol 82:49 — pre-exercise T positively correlated with %fat (r=0.72), SFA (r=0.77), MUFA (r=0.79); negatively with %protein (r=−0.71) and PUFA:SFA (r=−0.63)",
        satFatThreshold: "no upper-threshold studies for T specifically; Volek correlations support moderate SFA inclusion. Cardiovascular trade-off matters — do not chase T at lipid-panel cost",
        cholesterolSubstrate: "mechanistic — Leydig steroidogenesis via CYP11A1/17A1 from cholesterol",
        protein_g_per_kg: "1.6–2.2; Whittaker 2023 — >3.4 g/kg may suppress T via urea-cycle stress (operator floor: do not chase 3+ g/kg)",
        carbTimingCortisol: "carbs acutely blunt cortisol post-exercise (Bird/Tarpenning 2006); chronic T effect weak. Practical: ~50–100 g intra/post-workout carbs"
      },
      micronutrients: {
        zinc: "Prasad 1996 — deficiency drops T 39.9 → 10.6 nmol/L; repletion restores. Replete athletes do NOT see further T rise (Koehler 2009 Eur J Clin Nutr). Heavy-sweat operators particularly at risk; supplement 15–30 mg if intake is low",
        magnesium: "Cinar 2011 — 10 mg/kg/d × 4 wk in athletes raised free + total T at rest and post-exhaustion. Maggio 2011 InCHIANTI — serum Mg + corr with T, IGF-1 in older men",
        vitaminD: "Pilz 2011 — +25.2% T in deficient overweight men over 12 mo. Lerchbaum 2017 NULL in replete men. Target 25(OH)D 40–60 ng/mL; supplement only if deficient",
        boron: "Naghii 2011 — 10 mg/d × 7 d, n=8: free T +28%, E2 −39%; total T not significantly changed. Small sample, no placebo arm — adjunct, not anchor",
        selenium: "deficiency lowers spermatogenic markers; T data inconsistent in replete men (Safarinejad 2009)"
      },
      intermittentFasting: "Moro 2016 J Transl Med 14:290 — 16:8 TRE × 8 wk in resistance-trained men: total T fell ~25%, IGF-1 fell, fat mass dropped. Multiple TRE studies consistent — 10–30% T reductions. Caveat: usually co-occurs with energy deficit. Hypertrophy-primary operators should NOT run aggressive TRE during accumulation",
      alcohol: {
        acute: "Sarkola 2003 Alcohol Clin Exp Res — 1.5 g/kg dose: T −6.8% over 24 h; estradiol ↑",
        chronic: "Emanuele 1998 — testicular atrophy, ↓Leydig steroidogenesis, ↓LH pulse amplitude",
        beerPhytoestrogens: "8-prenylnaringenin (Milligan 1999 JCEM 84:2249) is the most potent known phytoestrogen, but content in beer (0.02–0.24 mg/L) is far below in vivo estrogenic threshold. Alcohol per se dominates the T-suppressive effect; the phytoestrogen panic is overstated. Chronic heavy beer drinkers may be exposed; moderate consumption: alcohol is the issue, not the hops",
        operatorCap: "≤7 standard drinks/wk; zero on training days near key sessions"
      },
      cruciferousDIM: "Bradlow 1995 / Michnovicz 1990 — I3C/DIM shifts estrogen metabolism toward 2-OH (less estrogenic) over 16-OH metabolites. Effect on serum T modest/null in men. Useful for E2 management, not a direct T lever"
    },
    bodyComposition: {
      target_BF_pct: "10–18% (operator heuristic)",
      cuttingProtocol: "slow rate ≤0.7%/wk (Garthe 2011 IJSNEM 21:97); diet breaks every 4–6 wk; refeeds 1–2×/wk at maintenance; preserve protein at 2.0–2.4 g/kg; avoid concurrent severe sleep restriction or high endurance load (compounding T suppression)",
      obesityReversal: "Corona 2013 meta — weight loss is the single largest natural lever for raising T in obese men; +2.87 nmol/L lifestyle, +8.73 nmol/L bariatric"
    },
    lifestyle: {
      stressManagement: "Brownlee 2005 + Whirledge & Cidlowski 2017 Endocrinology — chronic cortisol suppresses GnRH pulse generator. Daily practice: 10–20 min HRV-guided breathing, meditation, or zone-2 walking. Ashwagandha KSM-66 600 mg as pharmacological adjunct (Lopresti 2019 — cortisol −22%)",
      coldExposure: "limited direct evidence. Acute cold-water immersion produces transient T fluctuations; no high-quality RCT showing chronic T elevation. Recovery and parasympathetic value reasonable; T claims overstated",
      heatSauna: "Pilch 2013 J Hum Kinet 39:127 — Finnish sauna acutely raised cortisol and T (small, transient). HSP induction documented (Laukkanen 2015 JAMA Intern Med — CV mortality benefit). Chronic T data inconsistent. Sauna for recovery & CV is supported; for T, marginal",
      sexAndOrgasm: {
        debunkSteelman: "Jiang 2003 J Zhejiang Univ Sci 4:236 (claimed +145.7% T on day 7 of abstinence) was RETRACTED December 2021 (duplicate publication; data unverifiable). Replication failures across other groups. Exton 2001 showed modest 3-wk abstinence T rise. Operator implication: ejaculation has minimal lasting T impact. The 'no-fap for T' framing is overhyped"
      },
      endocrineDisruptors: "see environmentalPillar — practical avoidance, not panic",
      scrotalTemperature: {
        spermatogenesisVsT: "spermatogenesis is highly heat-sensitive; Leydig T production is much less so",
        wang1997: "Fertil Steril 68:334 — daily 30-min hot-water bath × 6 mo: sperm count fell, total T essentially unchanged",
        boxersBriefs: "Munkelwitz 1998 J Urol 160:1329 NULL on temperature/sperm/hormones in subfertile men; Mínguez-Alarcón 2018 Hum Reprod 33:1749 — boxer wearers had ~25% higher sperm conc and lower FSH but T NOT significantly different. Scrotal cooling is a fertility intervention, not a T lever"
      }
    },
    environmental: {
      phthalates: "Meeker & Ferguson 2014 NHANES JCEM 99:4346 — DEHP and DBP metabolites inversely associated with total T, free T, FAI in men 40–60 y. Avoid plastic food storage at heat (microwave, dishwasher); prefer glass/stainless. Joensen 2012 EHP — high MEHP excretion correlates with reduced T:LH",
      BPA: "vom Saal 2007 Reprod Toxicol 24:131; Lang 2008 JAMA 300:1303 (paradoxical positive T association in InCHIANTI, interpreted as anti-androgenic at receptor → compensatory rise); Scinicariello 2016 EHP — adolescent boys: BPA inversely associated with T. Mixed but plausible disruption. Practical: BPA-free containers, avoid receipt-paper handling, glass water bottles",
      microplastics: "emerging — Leslie 2022 Environ Int (MPs in human blood); recent Italian study Sci Total Environ 2024 (MPs in testis and semen). Animal data show Leydig dysfunction. HUMAN T-effect data not yet established — precautionary, not panic",
      atrazine: "Hayes 2002 PNAS 99:5476 — Xenopus tadpoles at 0.1 ppb hermaphroditism; adult males 25 ppb → 10× plasma T drop via aromatase induction. Sanderson 2000 confirmed aromatase induction in human H295R cells. HUMAN epidemiology mixed and confounded (Swan 2003); no human RCT. ANIMAL/MECH STRONG; HUMAN translation WEAK. Practical: filter tap water (carbon block + RO if possible); favor organic for high-pesticide-residue produce",
      personalCareProducts: "Scinicariello 2016 — BP-3 inversely associated with T in adolescent boys; parabens varied. Practical: paraben-free, phthalate-free personal care; reduce fragrance load",
      tapWaterFiltration: "no RCT showing filtered water raises T; rationale based on EDC migration data. Reasonable precaution for operators with high water intake"
    },
    supplementation: {
      vitaminD3: "2,000–5,000 IU/d to titrate 25(OH)D into 40–60 ng/mL window",
      zinc: "15–30 mg/d in deficient or high-sweat operators; do not exceed 40 mg UL chronically",
      magnesium: "200–400 mg elemental glycinate PM",
      boron: "6–10 mg/d optional adjunct (low risk, low cost, weak evidence)",
      ashwagandhaKSM66: "600 mg/d × 8–12 wk on / 2–4 wk off — strongest T-relevant adaptogen RCT base (Wankhede 2015, Lopresti 2019)",
      tongkatAli: "200–400 mg/d Physta® or LJ100® × 8 wk on / 2 wk off — moderate evidence in stressed/aging men",
      fadogiaAgrestis: "DO NOT INCLUDE — animal-only data with testicular toxicity signal at 28-d rat exposure (Yakubu 2008 J Ethnopharmacol 115:288). Zero published human RCTs. Despite Huberman/Attia popularization, the toxicology risk-benefit is unjustified",
      creatine: "3–5 g/d — modest/inconsistent T data (van der Merwe 2009 Clin J Sport Med 19:399 single rugby study showed +56% DHT, not replicated; Antonelli 2025 12-wk RCT no DHT change). Primary value is performance, secondary T effect speculative"
    }
  },
  periodizationPhaseDosing: {
    accumulation_weeks_1_to_4: {
      objective: "full T-support stack on; build training volume tolerance",
      sleep: "7–9 h non-negotiable; consistent timing",
      training: "heavy compounds 3–5×/wk; cap concurrent endurance ≤2 sessions/wk; mechanical tension priority",
      nutrition: "protein 1.6–2.2 g/kg; fat 25–35% kcal; energy at maintenance or modest surplus +5–10%",
      supplements: "vitamin D titrated, omega-3 2 g, magnesium 400 mg PM, zinc 15 mg if low intake, ashwagandha KSM-66 600 mg PM, tongkat ali 200 mg AM (if on cycle)",
      lifestyle: "alcohol ≤7 drinks/wk; daily 10–20 min stress-down practice"
    },
    intensification_week_5: {
      objective: "maximize recovery — sleep priority, ashwagandha, magnesium",
      sleep: "8–9 h target; aggressive sleep hygiene",
      training: "highest weekly volume; HPG-stress recovery emphasis",
      nutrition: "protein at 2.0–2.2 g/kg ceiling; intra/post-workout carbs 50–100 g for cortisol management",
      supplements: "ashwagandha 600 mg + magnesium glycinate 400 mg + glycine 3 g pre-bed mandatory; tart cherry 480 mg BID across wk 5–6",
      lifestyle: "ZERO alcohol; mandatory stress-down practice"
    },
    deload_week_6: {
      objective: "parasympathetic emphasis, sauna, low stress, supplement washout consideration",
      sleep: "+1 h vs accumulation if possible; full circadian alignment",
      training: "50–60% volume; movement quality focus",
      nutrition: "maintenance kcal; full micronutrient repletion",
      supplements: "consider 1-week washout for ashwagandha and tongkat ali (if 8-wk cycle ending); maintain vitamin D, omega-3, magnesium, zinc; STRIP CAFFEINE for receptor re-sensitization (couples with Entry 1 protocol)",
      lifestyle: "sauna 2–3×/wk × 15–20 min @ 175–195°F; cold exposure optional; outdoor low-intensity exposure"
    },
    cycleToCycleProtocols: {
      ashwagandha: "8–12 wk on / 2–4 wk off",
      tongkatAli: "8 wk on / 2 wk off",
      caffeine: "1–2 wk full washout every 8–12 wk (couples with Entry 1)",
      annualBloodwork: "see bloodworkPanel"
    }
  },
  bloodworkPanel: {
    cadence: "baseline + every 6 months in first year, then annually if stable",
    drawConditions: "AM 7–10 AM, fasting 10–12 h, no training within 48 h prior, no alcohol 72 h prior",
    panel: [
      "total testosterone (LC-MS/MS preferred over immunoassay; CDC HoSt-certified lab)",
      "free testosterone (equilibrium dialysis gold standard; calculated free T via Vermeulen acceptable if SHBG measured)",
      "SHBG",
      "estradiol — sensitive (LC-MS/MS) E2 (immunoassays unreliable in men)",
      "LH",
      "FSH",
      "DHEA-S",
      "morning cortisol (8 AM)",
      "prolactin (if secondary picture: low T + low/inappropriately normal LH)",
      "25(OH)-vitamin D",
      "TSH + free T4",
      "lipid panel (total chol, LDL-C, HDL-C, TG, ApoB if available)",
      "HbA1c",
      "CMP",
      "CBC (Hct baseline; flag if >52% on any T-support stack, hard stop >54% per Endocrine Society)",
      "ferritin, iron sat (hemochromatosis screen)",
      "PSA at baseline if >40 y or risk factors"
    ],
    referenceContext: {
      ageDecline: "Harman 2001 BLSA — total T ~−1%/yr, free T ~−2%/yr after 30; ~20% hypogonadal by 60s, ~30% by 70s, ~50% by 80s",
      secularDecline: "Travison 2007 — additional age-independent ~1%/yr cohort decline likely attributable to obesity, EDCs, lifestyle"
    }
  },
  TRTReferralCriteria: {
    endocrineSociety2018: "two confirmed AM total T <264 ng/dL on separate days WITH symptoms (low libido, ED, decreased morning erections, fatigue, loss of muscle mass, depressed mood, low BMD, mild anemia)",
    AUA2018_2024: "two confirmed AM total T <300 ng/dL WITH symptoms; target on TRT 450–600 ng/dL",
    primaryVsSecondary: "primary (high LH, testicular failure) — workup includes karyotype, ferritin (hemochromatosis), iron sat. Secondary (low/inappropriate LH) — workup includes prolactin, full pituitary screen, MRI if very low T <150 ng/dL or hyperprolactinemia or visual symptoms",
    functionalHypogonadism: "address modifiable causes first (obesity, OSA-with-obesity, opioid, glucocorticoid, alcohol, severe energy deficit); TRT only if persists after 3–6 mo of corrected lifestyle",
    monitoringOnTRT: "Hct quarterly first year (stop if >54%), PSA, lipid, symptoms"
  }
}
```

#### Protocol logic

The protocol is **ordered by signal-to-noise**. The biggest natural levers — sleep ≥7 h, body-fat normalization (avoid both obesity and contest-prep leanness), avoidance of severe energy deficits, alcohol moderation, and deficiency correction (vitamin D and zinc only if low) — sit at the top because they are supported by the strongest meta-analytic evidence. The hyped levers — cold plunges, sauna for T, no-fap cycling, exotic adaptogens — sit at the bottom because the human evidence is weak, retracted, or animal-only.

**The acute T spike from heavy lifting does not transfer to chronic hypertrophy.** West & Phillips 2010-2012 and Schoenfeld 2013 are unambiguous: post-set T/GH/IGF-1 spikes do not correlate with gains in lean body mass or strength. Mechanical tension dominates. However, **chronic baseline T does matter** — Kvorning 2006 showed that pharmacologically suppressing GnRH during 8-week RT attenuates strength and lean-mass gains. The implication is that operators should train hard for mechanical tension, not hormone spikes, but should also defend baseline endogenous T through sleep, body composition, and avoiding chronic high-volume endurance.

**Concurrent training interference is real and underestimated.** Wilson 2012 meta-analysis (JSCR 26:2293) shows endurance modality and volume drive interference, with running > cycling. The Exercise-Hypogonadal Male Condition (Hackney 2005) requires years of high-mileage endurance (100–200 km/wk running) but is documented and dose-responsive. Hypertrophy-primary operators should cap weekly endurance at 2–3 sessions and ≤45 min, with the protocol explicitly downgrading endurance during intensification weeks.

**Macronutrient distribution matters more than total calories for T, within reason.** Whittaker & Wu 2021 meta of six crossover trials shows low-fat diets (~20% kcal) reduce total T by ~57 ng/dL versus higher-fat diets (~40% kcal). Hämäläinen 1984 showed the effect is reversible within 6 weeks. The protocol targets 25–35% fat with MUFA emphasis and moderate SFA, anchored on Volek 1997 correlation data. Protein stays at 1.6–2.2 g/kg — pushing >3.4 g/kg may suppress T via urea-cycle stress (Whittaker 2023). Aggressive 16:8 TRE drops T ~25% in resistance-trained men (Moro 2016) and is excluded from the protocol during accumulation phases.

**The endocrine disruptor pillar is precautionary.** Phthalate-T inverse association is the strongest human evidence (Meeker & Ferguson 2014 NHANES, 2208 men, consistent inverse association across DEHP and DBP metabolites). BPA is mixed-direction in InCHIANTI (paradoxical positive in adults, inverse in adolescent boys). Atrazine human translation is weak — Hayes 2002 frog data are mechanistically clear but human epidemiology is confounded. Microplastics in human testis and semen are documented but T-effect not yet established. The protocol's environmental layer is therefore **toxicologically precautionary** — practical avoidance of phthalates, BPA, and pesticides — without claiming dramatic T benefits.

**The supplement layer is honest about evidence ceilings.** Vitamin D supplementation works only in deficient men (Pilz 2011 effect; Lerchbaum 2017 null in replete). Zinc supplementation works only in deficient men (Prasad 1996 deficiency model; Koehler 2009 null in replete athletes). Magnesium is modest and primarily mediated by sleep quality. Boron has a single n=8 single-arm pre/post study — useful adjunct, not anchor. Ashwagandha KSM-66 has the strongest RCT base (~14–17% T rise across multiple trials). Tongkat ali has moderate evidence in stressed/aging men. **Fadogia agrestis is excluded entirely** because the 2008 Yakubu rat data showed testicular toxicity at 28-day exposure, no human RCTs exist, and the Huberman-popularized 600 mg dose is not based on any human pharmacokinetic or safety data.

**Body composition is bidirectional.** Obesity drives aromatization and hypogonadotropic hypogonadism (Cohen 1999 cycle, validated by Corona 2013 weight-loss meta showing +2.87 nmol/L lifestyle / +8.73 nmol/L bariatric). Contest-prep leanness drops T just as severely (Pardue 2017 case study, −72% T). The 10–18% body-fat target window is operator-pragmatic, not RCT-defined.

#### Adverse response signals

Suspect HPG axis suppression and lab-test if: sustained morning fatigue >4 wk despite adequate sleep; loss of morning erections; libido drop >2 wk; unexplained mood degradation; loss of training drive across consecutive accumulation phases; unexplained strength regression with otherwise normal sleep, nutrition, and load. Bloodwork order: total T (LC-MS/MS preferred), free T (equilibrium dialysis or calculated), SHBG, sensitive E2, LH, FSH, prolactin, morning cortisol, 25(OH)D, TSH, ferritin, lipids, HbA1c. Two AM draws on separate days, fasting, no training within 48 h prior, no alcohol 72 h prior. **Do not act on a single low value** — Endocrine Society 2018 explicitly notes ~30% of men with one low total T show normal repeat. **Hard stop on this protocol** and seek clinical evaluation if: total T <264 ng/dL on two AM draws WITH symptoms, hematocrit >52% trending toward 54%, persistent gynecomastia or estradiol >50 pg/mL, suspected pituitary symptoms (visual changes, severe headache), or any concerning labs (ferritin >300 with elevated iron sat suggesting hemochromatosis).

#### Integration notes

Protocol pairs directly with Entry 1 (`hypertrophy_supplement_stack`) — supplement dosing in this entry references compounds defined in Entry 1, and the periodization phase mapping is identical. Both entries integrate with all five GUNS UP periodization templates (RP Hypertrophy 4-Day, PPL 6-Day, Upper/Lower 4-Day, Arnold Split 6-Day, Israetel Scientific Block) without modification.

**Tactical operators** are the highest-risk T population: chronic sleep deprivation, mission cortisol, hot/cold environmental swings, periodic severe energy deficits (selection courses), and concurrent cardiovascular load all suppress T simultaneously. The Friedl/Pasiakos Ranger data document 50–70% T drops in 8 weeks of severe combined stressors. For tactical operators, the sleep, energy availability, and concurrent-training-cap pillars matter more than any supplement; the supplement layer is a remediation tool, not a prophylactic.

**Aesthetic operators** in cutting phases face the Pardue 2017 leanness-suppression risk. Slow cuts (≤0.7%/wk per Garthe 2011), refeeds 1–2×/wk at maintenance, protein at 2.0–2.4 g/kg ceiling, and aggressive sleep protection during deficit are the protective levers. Avoid combining a steep cut with high endurance volume and severe sleep restriction — the suppressive stack is multiplicative.

**Operators ≥35 y** see the largest baseline ROI on the supplement and bloodwork layers because Harman 2001 BLSA documents ~1%/yr total T and ~2%/yr free T decline after 30. Travison 2007 adds a secular ~1%/yr cohort decline on top of normal aging, likely attributable to obesity, EDCs, and lifestyle. For operators ≥40 y with two confirmed AM total T <300 ng/dL and symptoms, refer per AUA 2018/2024 guidelines for endocrinology consult — but require workup of functional causes (obesity, OSA-with-obesity, opioid use, glucocorticoid use, alcohol, severe energy deficit) before initiating TRT. TRT is a one-way door for endogenous HPG function; the natural protocol should be exhausted first in any operator with reversible functional causes.

The protocol is designed to be drug-test compliant: ecdysterone is excluded (WADA Monitoring Program 2020+), all supplements should carry NSF Certified for Sport, Informed Sport, or BSCG Certified Drug Free verification, and the protocol does not depend on any prohormone, SARM, or exogenous androgen.
