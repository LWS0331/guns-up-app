import { Operator, AiTier } from '@/lib/types';

// Helper to create a new client operator with defaults
function makeClient(
  id: string, name: string, callsign: string, pin: string, tier: AiTier,
  coupleWith: string | null, trainerId: string, betaUser: boolean,
  profile: Partial<Operator['profile']>, prefs: Partial<Operator['preferences']>,
  lang?: 'es',
  teamId?: string,
): Operator {
  return {
    id, name, callsign, pin, role: 'client', tier, coupleWith, trainerId, betaUser, teamId,
    profile: {
      age: profile.age ?? 30, height: profile.height ?? "5'8\"", weight: profile.weight ?? 170,
      bodyFat: profile.bodyFat ?? 20, trainingAge: profile.trainingAge ?? '2 years',
      goals: profile.goals ?? ['general fitness'], readiness: profile.readiness ?? 7,
      sleep: profile.sleep ?? 7, stress: profile.stress ?? 4,
    },
    nutrition: { targets: { calories: 2200, protein: 160, carbs: 220, fat: 75 }, meals: {} },
    prs: [], injuries: [], workouts: {}, dayTags: {},
    preferences: {
      split: prefs.split ?? 'Full Body', equipment: prefs.equipment ?? ['Dumbbell', 'Barbell'],
      sessionDuration: prefs.sessionDuration ?? 60, daysPerWeek: prefs.daysPerWeek ?? 3,
      weakPoints: prefs.weakPoints ?? [], avoidMovements: prefs.avoidMovements ?? [],
    },
  };
}

export const OPERATORS: Operator[] = [
  {
    id: 'op-ruben',
    name: 'Ruben Rodriguez',
    callsign: 'RAMPAGE',
    pin: '1234',
    // Pre-seeded email so the Google OAuth callback links the first
    // ruben@gunsupfitness.com sign-in to this existing operator (with all
    // his trainer data) instead of creating a fresh op-google-... record.
    // Update via DB if the chosen email differs.
    email: 'ruben@gunsupfitness.com',
    role: 'trainer',
    tier: 'opus',
    coupleWith: 'op-britney',
    teamId: 'team-wolf-pack',
    clientIds: ['op-efrain', 'op-erika', 'op-jonathan', 'op-natalie', 'op-mary', 'op-harold', 'op-rosa', 'op-rubensr', 'op-edgar', 'op-patty', 'op-aldo', 'op-jasmine', 'op-arnold', 'op-lynette'],
    betaUser: true,
    profile: {
      age: 31,
      height: "5'10\"",
      weight: 195,
      bodyFat: 16,
      trainingAge: '12 years',
      goals: ['strength', 'hypertrophy'],
      readiness: 8,
      sleep: 7.5,
      stress: 3,
    },
    nutrition: {
      targets: {
        calories: 2800,
        protein: 220,
        carbs: 280,
        fat: 90,
      },
      meals: {
        '2026-03-20': [
          {
            id: 'meal-1',
            name: 'Breakfast - Eggs and Oats',
            calories: 550,
            protein: 35,
            carbs: 65,
            fat: 18,
            time: '07:00',
          },
          {
            id: 'meal-2',
            name: 'Mid-morning Snack - Protein Shake',
            calories: 350,
            protein: 45,
            carbs: 35,
            fat: 8,
            time: '10:00',
          },
          {
            id: 'meal-3',
            name: 'Lunch - Chicken and Rice',
            calories: 750,
            protein: 60,
            carbs: 85,
            fat: 20,
            time: '12:30',
          },
          {
            id: 'meal-4',
            name: 'Pre-workout - Banana and Almond Butter',
            calories: 300,
            protein: 15,
            carbs: 40,
            fat: 12,
            time: '15:30',
          },
          {
            id: 'meal-5',
            name: 'Dinner - Steak and Sweet Potato',
            calories: 850,
            protein: 65,
            carbs: 55,
            fat: 32,
            time: '19:00',
          },
        ],
      },
    },
    prs: [
      {
        id: 'pr-1',
        exercise: 'Back Squat',
        weight: 405,
        reps: 1,
        date: '2026-02-28',
        notes: 'Solid lift, good depth',
      },
      {
        id: 'pr-2',
        exercise: 'Bench Press',
        weight: 315,
        reps: 1,
        date: '2026-03-05',
        notes: 'New PR!',
      },
      {
        id: 'pr-3',
        exercise: 'Deadlift',
        weight: 495,
        reps: 1,
        date: '2026-02-15',
        notes: 'Could probably get 505 soon',
      },
    ],
    injuries: [
      {
        id: 'inj-1',
        name: 'Right shoulder impingement',
        status: 'active',
        notes: 'Limiting bench pressing depth, especially overhead movements',
        restrictions: ['Overhead Press above 225', 'Wide grip exercises'],
      },
    ],
    preferences: {
      split: 'Push/Pull/Legs',
      equipment: ['Barbell', 'Dumbbell', 'Cable'],
      sessionDuration: 90,
      daysPerWeek: 5,
      weakPoints: ['Shoulders', 'Weak point lockout on bench'],
      avoidMovements: ['Overhead Press (limited)', 'Behind neck work'],
    },
    workouts: {
      '2026-03-20': {
        id: 'wk-1',
        date: '2026-03-20',
        title: 'Push Day - Chest & Shoulders',
        notes: 'Worked around shoulder impingement, excellent volume',
        warmup: '10 min bike, band pull-aparts, arm circles',
        blocks: [
          {
            type: 'exercise',
            id: 'block-1',
            sortOrder: 1,
            exerciseName: 'Bench Press',
            prescription: '4x5 @ 275',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-2',
            sortOrder: 2,
            exerciseName: 'Incline Bench Press',
            prescription: '4x6 @ 245',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-3',
            sortOrder: 3,
            exerciseName: 'Dumbbell Press',
            prescription: '3x8 @ 85s',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-4',
            sortOrder: 4,
            exerciseName: 'Lateral Raise',
            prescription: '3x12 @ 25s',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-5',
            sortOrder: 5,
            exerciseName: 'Tricep Pushdown',
            prescription: '3x10 @ 120',
            isLinkedToNext: false,
          },
        ],
        cooldown: '5 min walking, stretching',
        completed: true,
      },
      '2026-03-19': {
        id: 'wk-2',
        date: '2026-03-19',
        title: 'Pull Day - Back & Biceps',
        notes: 'Strong deadlift day, all reps were smooth',
        warmup: '5 min rowing, dead hangs, scapular pull-ups',
        blocks: [
          {
            type: 'exercise',
            id: 'block-6',
            sortOrder: 1,
            exerciseName: 'Deadlift',
            prescription: '3x3 @ 455',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-7',
            sortOrder: 2,
            exerciseName: 'Barbell Row',
            prescription: '4x5 @ 315',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-8',
            sortOrder: 3,
            exerciseName: 'Pull Up',
            prescription: '4x6 @ +45',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-9',
            sortOrder: 4,
            exerciseName: 'Lat Pulldown',
            prescription: '3x8 @ 210',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-10',
            sortOrder: 5,
            exerciseName: 'Bicep Curl',
            prescription: '3x10 @ 35s',
            isLinkedToNext: false,
          },
        ],
        cooldown: '5 min bike, foam rolling',
        completed: true,
      },
      '2026-03-18': {
        id: 'wk-3',
        date: '2026-03-18',
        title: 'Leg Day - Heavy Squats',
        notes: 'Great energy today, felt strong throughout',
        warmup: '10 min bike, leg swings, bodyweight squats',
        blocks: [
          {
            type: 'exercise',
            id: 'block-11',
            sortOrder: 1,
            exerciseName: 'Back Squat',
            prescription: '5x3 @ 365',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-12',
            sortOrder: 2,
            exerciseName: 'Leg Press',
            prescription: '4x6 @ 600',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-13',
            sortOrder: 3,
            exerciseName: 'Romanian Deadlift',
            prescription: '3x8 @ 315',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-14',
            sortOrder: 4,
            exerciseName: 'Leg Curl',
            prescription: '3x10 @ 200',
            isLinkedToNext: false,
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-15',
            sortOrder: 5,
            format: 'AMRAP 5 min',
            description: '10 Box Jumps + 10 Wall Balls + 10 Burpees',
          },
        ],
        cooldown: '10 min walking, stretching',
        completed: true,
      },
    },
    dayTags: {
      '2026-03-20': {
        color: 'green',
        note: 'Great session, felt strong',
      },
    },
  },
  {
    id: 'op-britney',
    name: 'Britney Rodriguez',
    callsign: 'VALKYRIE',
    pin: '5678',
    role: 'trainer',
    tier: 'opus',
    coupleWith: 'op-ruben',
    teamId: 'team-madheart',
    clientIds: ['op-efrain', 'op-erika', 'op-jonathan', 'op-natalie', 'op-mary', 'op-harold', 'op-rosa', 'op-rubensr', 'op-edgar', 'op-patty', 'op-aldo', 'op-jasmine', 'op-arnold', 'op-lynette'],
    betaUser: true,
    profile: {
      age: 29,
      height: "5'5\"",
      weight: 140,
      bodyFat: 22,
      trainingAge: '4 years',
      goals: ['toning', 'endurance'],
      readiness: 7,
      sleep: 7,
      stress: 4,
    },
    nutrition: {
      targets: {
        calories: 1800,
        protein: 130,
        carbs: 180,
        fat: 65,
      },
      meals: {
        '2026-03-20': [
          {
            id: 'meal-1',
            name: 'Breakfast - Greek Yogurt and Granola',
            calories: 350,
            protein: 25,
            carbs: 45,
            fat: 12,
            time: '07:30',
          },
          {
            id: 'meal-2',
            name: 'Mid-morning Snack - Apple and Peanut Butter',
            calories: 250,
            protein: 10,
            carbs: 32,
            fat: 10,
            time: '10:00',
          },
          {
            id: 'meal-3',
            name: 'Lunch - Turkey and Quinoa Salad',
            calories: 450,
            protein: 40,
            carbs: 50,
            fat: 15,
            time: '12:30',
          },
          {
            id: 'meal-4',
            name: 'Pre-workout - Banana',
            calories: 120,
            protein: 1,
            carbs: 27,
            fat: 0,
            time: '15:30',
          },
          {
            id: 'meal-5',
            name: 'Dinner - Salmon and Broccoli',
            calories: 630,
            protein: 54,
            carbs: 26,
            fat: 28,
            time: '19:00',
          },
        ],
      },
    },
    prs: [
      {
        id: 'pr-1',
        exercise: 'Back Squat',
        weight: 185,
        reps: 3,
        date: '2026-03-01',
        notes: 'Getting stronger!',
      },
      {
        id: 'pr-2',
        exercise: 'Bench Press',
        weight: 115,
        reps: 5,
        date: '2026-02-20',
        notes: 'Solid strength',
      },
      {
        id: 'pr-3',
        exercise: 'Deadlift',
        weight: 225,
        reps: 3,
        date: '2026-02-10',
        notes: 'Great form',
      },
    ],
    injuries: [],
    preferences: {
      split: 'Upper/Lower',
      equipment: ['Dumbbell', 'Cable', 'Barbell'],
      sessionDuration: 60,
      daysPerWeek: 4,
      weakPoints: ['Hamstrings', 'Lat strength'],
      avoidMovements: [],
    },
    workouts: {
      '2026-03-20': {
        id: 'wk-1',
        date: '2026-03-20',
        title: 'Upper Body - Strength & Endurance',
        notes: 'Felt energized today, good conditioning work',
        warmup: '5 min bike, shoulder mobility, light cardio',
        blocks: [
          {
            type: 'exercise',
            id: 'block-1',
            sortOrder: 1,
            exerciseName: 'Bench Press',
            prescription: '3x5 @ 105',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-2',
            sortOrder: 2,
            exerciseName: 'Barbell Row',
            prescription: '3x5 @ 145',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-3',
            sortOrder: 3,
            exerciseName: 'Dumbbell Press',
            prescription: '3x8 @ 35s',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-4',
            sortOrder: 4,
            exerciseName: 'Lat Pulldown',
            prescription: '3x8 @ 140',
            isLinkedToNext: false,
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-5',
            sortOrder: 5,
            format: '3 rounds',
            description: '10 Pull Ups + 15 Ring Rows + 20 Push Ups',
          },
        ],
        cooldown: '5 min walking, stretching',
        completed: true,
      },
      '2026-03-19': {
        id: 'wk-2',
        date: '2026-03-19',
        title: 'Lower Body - Squat Focus',
        notes: 'Solid leg day, quads are getting stronger',
        warmup: '10 min bike, leg swings, bodyweight squats',
        blocks: [
          {
            type: 'exercise',
            id: 'block-6',
            sortOrder: 1,
            exerciseName: 'Back Squat',
            prescription: '4x5 @ 165',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-7',
            sortOrder: 2,
            exerciseName: 'Romanian Deadlift',
            prescription: '3x8 @ 165',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-8',
            sortOrder: 3,
            exerciseName: 'Leg Extension',
            prescription: '3x10 @ 160',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-9',
            sortOrder: 4,
            exerciseName: 'Leg Curl',
            prescription: '3x10 @ 140',
            isLinkedToNext: false,
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-10',
            sortOrder: 5,
            format: '4 rounds',
            description: '200m run + 15 box jumps',
          },
        ],
        cooldown: '10 min walking, stretching',
        completed: true,
      },
      '2026-03-18': {
        id: 'wk-3',
        date: '2026-03-18',
        title: 'Upper Body - Endurance Day',
        notes: 'Higher rep work, great pump',
        warmup: '5 min rowing, arm circles, scapular work',
        blocks: [
          {
            type: 'exercise',
            id: 'block-11',
            sortOrder: 1,
            exerciseName: 'Dumbbell Bench Press',
            prescription: '3x10 @ 40s',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-12',
            sortOrder: 2,
            exerciseName: 'Dumbbell Row',
            prescription: '3x10 @ 45s',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-13',
            sortOrder: 3,
            exerciseName: 'Incline Dumbbell Press',
            prescription: '3x12 @ 30s',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-14',
            sortOrder: 4,
            exerciseName: 'Face Pull',
            prescription: '3x12 @ 110',
            isLinkedToNext: false,
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-15',
            sortOrder: 5,
            format: '15 min AMRAP',
            description: 'Assault bike intervals - 30 sec hard, 30 sec easy',
          },
        ],
        cooldown: '5 min walking, stretching',
        completed: true,
      },
    },
    dayTags: {
      '2026-03-20': {
        color: 'green',
        note: 'Solid upper day',
      },
    },
  },
  {
    id: 'op-efrain',
    name: 'Efrain Cruz',
    callsign: 'WARDOG',
    pin: '1111',
    role: 'client',
    // Demoted COMMANDER (opus) → OPERATOR (sonnet) — May 2026 cost-control
    // pass. The Apr 2026 beta-testing promotion to opus is over;
    // adult clients now run on sonnet by default with only the
    // trainer accounts (Ruben + Britney) on opus.
    tier: 'sonnet',
    coupleWith: 'op-erika',
    trainerId: 'op-ruben',
    teamId: 'team-wolf-pack',
    betaUser: true,
    profile: {
      age: 33,
      height: "5'9\"",
      weight: 210,
      bodyFat: 18,
      trainingAge: '15 years',
      goals: ['maximal strength', 'competition prep'],
      readiness: 8,
      sleep: 8,
      stress: 2,
    },
    nutrition: {
      targets: {
        calories: 3200,
        protein: 250,
        carbs: 320,
        fat: 105,
      },
      meals: {
        '2026-03-20': [
          {
            id: 'meal-1',
            name: 'Breakfast - Steak and Eggs',
            calories: 650,
            protein: 60,
            carbs: 40,
            fat: 25,
            time: '07:00',
          },
          {
            id: 'meal-2',
            name: 'Mid-morning - Protein and Rice',
            calories: 450,
            protein: 50,
            carbs: 55,
            fat: 10,
            time: '10:00',
          },
          {
            id: 'meal-3',
            name: 'Lunch - Chicken and Potatoes',
            calories: 750,
            protein: 70,
            carbs: 85,
            fat: 20,
            time: '12:30',
          },
          {
            id: 'meal-4',
            name: 'Pre-workout - Rice Cakes and Honey',
            calories: 400,
            protein: 5,
            carbs: 85,
            fat: 4,
            time: '15:00',
          },
          {
            id: 'meal-5',
            name: 'Dinner - Salmon and Sweet Potato',
            calories: 950,
            protein: 65,
            carbs: 75,
            fat: 46,
            time: '19:30',
          },
        ],
      },
    },
    prs: [
      {
        id: 'pr-1',
        exercise: 'Back Squat',
        weight: 500,
        reps: 2,
        date: '2026-02-28',
        notes: 'Competition standard',
      },
      {
        id: 'pr-2',
        exercise: 'Bench Press',
        weight: 365,
        reps: 1,
        date: '2026-03-10',
        notes: 'New PR, felt strong',
      },
      {
        id: 'pr-3',
        exercise: 'Deadlift',
        weight: 585,
        reps: 1,
        date: '2026-02-05',
        notes: 'Total at meet prep',
      },
    ],
    injuries: [
      {
        id: 'inj-1',
        name: 'Lower back strain',
        status: 'recovering',
        notes: 'Mild strain from competition training, avoiding max effort deadlifts',
        restrictions: ['Max effort deadlifts', 'Heavy bent over rows'],
      },
    ],
    preferences: {
      split: 'Conjugate',
      equipment: ['Barbell', 'Chains', 'Bands'],
      sessionDuration: 120,
      daysPerWeek: 5,
      weakPoints: ['Deadlift lockout', 'Squat depth at heavy weights'],
      avoidMovements: ['Excessive spinal flexion'],
    },
    workouts: {
      '2026-03-20': {
        id: 'wk-1',
        date: '2026-03-20',
        title: 'Max Effort Squat Day',
        notes: 'Worked with chains, managing back strain well',
        warmup: '10 min bike, mobility, bar work',
        blocks: [
          {
            type: 'exercise',
            id: 'block-1',
            sortOrder: 1,
            exerciseName: 'Front Squat',
            prescription: '5x2 @ 465',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-2',
            sortOrder: 2,
            exerciseName: 'Bulgarian Split Squat',
            prescription: '4x5 @ 90s',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-3',
            sortOrder: 3,
            exerciseName: 'Leg Press',
            prescription: '3x6 @ 700',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-4',
            sortOrder: 4,
            exerciseName: 'Leg Curl',
            prescription: '3x8 @ 240',
            isLinkedToNext: false,
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-5',
            sortOrder: 5,
            format: '3 rounds',
            description: '10 Kettlebell Swings (70) + 15 Wall Balls (20)',
          },
        ],
        cooldown: '10 min walking, mobility work',
        completed: true,
      },
      '2026-03-19': {
        id: 'wk-2',
        date: '2026-03-19',
        title: 'Dynamic Effort Bench Day',
        notes: 'Speed work with bands, felt explosive',
        warmup: '5 min bike, band work, light bar',
        blocks: [
          {
            type: 'exercise',
            id: 'block-6',
            sortOrder: 1,
            exerciseName: 'Bench Press',
            prescription: '8x2 @ 275 + bands',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-7',
            sortOrder: 2,
            exerciseName: 'Incline Bench Press',
            prescription: '4x5 @ 295',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-8',
            sortOrder: 3,
            exerciseName: 'Dumbbell Floor Press',
            prescription: '3x6 @ 110s',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-9',
            sortOrder: 4,
            exerciseName: 'Tricep Pushdown',
            prescription: '3x8 @ 160',
            isLinkedToNext: false,
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-10',
            sortOrder: 5,
            format: '10 min AMRAP',
            description: 'Rowing - 500m test',
          },
        ],
        cooldown: '5 min walking, foam rolling',
        completed: true,
      },
      '2026-03-18': {
        id: 'wk-3',
        date: '2026-03-18',
        title: 'Supplemental Upper Day',
        notes: 'Focused on upper back and shoulder health',
        warmup: '5 min rowing, mobility, scapular work',
        blocks: [
          {
            type: 'exercise',
            id: 'block-11',
            sortOrder: 1,
            exerciseName: 'Barbell Row',
            prescription: '5x3 @ 405',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-12',
            sortOrder: 2,
            exerciseName: 'Pull Up',
            prescription: '4x5 @ +75',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-13',
            sortOrder: 3,
            exerciseName: 'Face Pull',
            prescription: '4x12 @ 150',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-14',
            sortOrder: 4,
            exerciseName: 'Pendulum Row',
            prescription: '3x6 @ 450',
            isLinkedToNext: false,
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-15',
            sortOrder: 5,
            format: 'EMOM 12 min',
            description: 'Min 1: 8 Burpees, Min 2: 12 Cal Assault Bike, Min 3: Rest',
          },
        ],
        cooldown: '10 min walking, stretching',
        completed: true,
      },
    },
    dayTags: {
      '2026-03-20': {
        color: 'green',
        note: 'Strong squat day despite back recovery',
      },
    },
  },
  {
    id: 'op-erika',
    name: 'Erika Cruz',
    callsign: 'PHOENIX',
    pin: '2222',
    role: 'client',
    // Demoted COMMANDER (opus) → OPERATOR (sonnet) — May 2026 cost-control
    // pass. See WARDOG above for full rationale.
    tier: 'sonnet',
    coupleWith: 'op-efrain',
    trainerId: 'op-ruben',
    teamId: 'team-wolf-pack',
    betaUser: true,
    profile: {
      age: 30,
      height: "5'4\"",
      weight: 135,
      bodyFat: 20,
      trainingAge: '6 years',
      goals: ['functional fitness', 'performance'],
      readiness: 8,
      sleep: 7.5,
      stress: 3,
    },
    nutrition: {
      targets: {
        calories: 2000,
        protein: 145,
        carbs: 200,
        fat: 70,
      },
      meals: {
        '2026-03-20': [
          {
            id: 'meal-1',
            name: 'Breakfast - Oatmeal and Berries',
            calories: 420,
            protein: 15,
            carbs: 60,
            fat: 14,
            time: '07:00',
          },
          {
            id: 'meal-2',
            name: 'Mid-morning - Protein Bar',
            calories: 250,
            protein: 20,
            carbs: 32,
            fat: 8,
            time: '10:00',
          },
          {
            id: 'meal-3',
            name: 'Lunch - Tuna and Pasta',
            calories: 550,
            protein: 45,
            carbs: 65,
            fat: 15,
            time: '12:30',
          },
          {
            id: 'meal-4',
            name: 'Pre-workout - Rice Cakes',
            calories: 200,
            protein: 3,
            carbs: 50,
            fat: 1,
            time: '15:30',
          },
          {
            id: 'meal-5',
            name: 'Dinner - Chicken and Veggies',
            calories: 580,
            protein: 62,
            carbs: 45,
            fat: 18,
            time: '19:00',
          },
        ],
      },
    },
    prs: [
      {
        id: 'pr-1',
        exercise: 'Back Squat',
        weight: 205,
        reps: 3,
        date: '2026-03-05',
        notes: 'Nice lift',
      },
      {
        id: 'pr-2',
        exercise: 'Clean and Jerk',
        weight: 155,
        reps: 1,
        date: '2026-02-25',
        notes: 'Great technique',
      },
      {
        id: 'pr-3',
        exercise: 'Snatch',
        weight: 115,
        reps: 1,
        date: '2026-02-20',
        notes: 'Form improving',
      },
    ],
    injuries: [],
    preferences: {
      split: 'CrossFit style',
      equipment: ['Barbell', 'Kettlebell', 'Box', 'Rower'],
      sessionDuration: 75,
      daysPerWeek: 5,
      weakPoints: ['Snatch technique', 'Shoulder endurance'],
      avoidMovements: [],
    },
    workouts: {
      '2026-03-20': {
        id: 'wk-1',
        date: '2026-03-20',
        title: 'Olympic Day - Weightlifting Focus',
        notes: 'Great snatch session, technique felt sharp',
        warmup: '10 min bike, shoulder mobility, empty bar',
        blocks: [
          {
            type: 'exercise',
            id: 'block-1',
            sortOrder: 1,
            exerciseName: 'Snatch',
            prescription: '5x2 @ 105',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-2',
            sortOrder: 2,
            exerciseName: 'Clean and Jerk',
            prescription: '5x2 @ 135',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-3',
            sortOrder: 3,
            exerciseName: 'Back Squat',
            prescription: '3x5 @ 185',
            isLinkedToNext: false,
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-4',
            sortOrder: 4,
            format: '3 rounds for time',
            description: '10 Snatches (95) + 15 Box Jumps + 500m run',
          },
        ],
        cooldown: '5 min walking, stretching',
        completed: true,
      },
      '2026-03-19': {
        id: 'wk-2',
        date: '2026-03-19',
        title: 'Gymnastics Strength Day',
        notes: 'Focused on body control and gymnastics skills',
        warmup: '10 min rowing, stretching, handstand practice',
        blocks: [
          {
            type: 'exercise',
            id: 'block-5',
            sortOrder: 1,
            exerciseName: 'Pull Up',
            prescription: '5x5',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-6',
            sortOrder: 2,
            exerciseName: 'Muscle Up',
            prescription: '5x3',
            isLinkedToNext: false,
          },
          {
            type: 'exercise',
            id: 'block-7',
            sortOrder: 3,
            exerciseName: 'Handstand Push Up',
            prescription: '5x5',
            isLinkedToNext: false,
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-8',
            sortOrder: 4,
            format: 'EMOM 20 min',
            description: 'Min 1: 8 Muscle Ups, Min 2: 12 Cal Bike, Min 3: Rest',
          },
        ],
        cooldown: '10 min walking, foam rolling',
        completed: true,
      },
      '2026-03-18': {
        id: 'wk-3',
        date: '2026-03-18',
        title: 'Metabolic Conditioning Day',
        notes: 'High intensity, good conditioning work',
        warmup: '5 min bike, mobility, light movement',
        blocks: [
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-9',
            sortOrder: 1,
            format: '5 rounds for time',
            description: '20 Kettlebell Swings (53) + 15 Burpees + 400m run',
          },
          {
            type: 'conditioning',
            isLinkedToNext: false,
            id: 'block-10',
            sortOrder: 2,
            format: 'Rest 3 min, then',
            description: 'Max distance assault bike in 5 min',
          },
        ],
        cooldown: '10 min walking, stretching',
        completed: true,
      },
    },
    dayTags: {
      '2026-03-20': {
        color: 'green',
        note: 'Sharp snatch technique today',
      },
    },
  },
  // ═══════════════════════════════════════
  // NEW USERS — Beta Wave 2
  // ═══════════════════════════════════════

  // Jonathan + Natalie (MADHEART)
  makeClient('op-jonathan', 'Jonathan', 'IRONSIDE', '3001', 'sonnet', 'op-natalie', 'op-ruben', true,
    { age: 32, height: "5'11\"", weight: 190, bodyFat: 17, trainingAge: '5 years', goals: ['strength', 'hypertrophy'], readiness: 7, sleep: 7, stress: 4 },
    { split: 'Push/Pull/Legs', equipment: ['Barbell', 'Dumbbell', 'Cable'], sessionDuration: 75, daysPerWeek: 4, weakPoints: ['Shoulders'], avoidMovements: [] },
    undefined, 'team-madheart'),
  makeClient('op-natalie', 'Natalie', 'NOVA', '3002', 'haiku', 'op-jonathan', 'op-ruben', true,
    { age: 30, height: "5'6\"", weight: 140, bodyFat: 23, trainingAge: '2 years', goals: ['toning', 'weight loss'], readiness: 7, sleep: 7.5, stress: 3 },
    { split: 'Upper/Lower', equipment: ['Dumbbell', 'Cable', 'Bodyweight'], sessionDuration: 45, daysPerWeek: 3, weakPoints: ['Core strength'], avoidMovements: [] },
    undefined, 'team-madheart'),

  // Mary + Harold (MADHEART)
  makeClient('op-mary', 'Mary', 'EMBER', '3003', 'haiku', 'op-harold', 'op-ruben', true,
    { age: 58, height: "5'3\"", weight: 155, bodyFat: 30, trainingAge: '1 year', goals: ['mobility', 'weight loss', 'bone density'], readiness: 6, sleep: 6.5, stress: 5 },
    { split: 'Full Body', equipment: ['Dumbbell', 'Cable', 'Bodyweight'], sessionDuration: 40, daysPerWeek: 3, weakPoints: ['Balance', 'Hip mobility'], avoidMovements: ['Heavy overhead press', 'Box jumps'] },
    undefined, 'team-madheart'),
  makeClient('op-harold', 'Harold', 'GENERAL', '3004', 'haiku', 'op-mary', 'op-ruben', true,
    { age: 62, height: "5'9\"", weight: 185, bodyFat: 28, trainingAge: '1 year', goals: ['mobility', 'heart health', 'strength maintenance'], readiness: 6, sleep: 6, stress: 4 },
    { split: 'Full Body', equipment: ['Dumbbell', 'Cable', 'Machine'], sessionDuration: 45, daysPerWeek: 3, weakPoints: ['Lower back', 'Knee stability'], avoidMovements: ['Heavy squats', 'Running'] },
    undefined, 'team-madheart'),

  // Rosa + Ruben Sr. (WOLF PACK, Spanish-preferred)
  makeClient('op-rosa', 'Rosa Rodriguez', 'REINA', '3005', 'haiku', 'op-rubensr', 'op-ruben', true,
    { age: 56, height: "5'2\"", weight: 148, bodyFat: 32, trainingAge: '6 months', goals: ['weight loss', 'mobility', 'energy'], readiness: 6, sleep: 6, stress: 5 },
    { split: 'Full Body', equipment: ['Dumbbell', 'Bodyweight', 'Resistance Band'], sessionDuration: 35, daysPerWeek: 3, weakPoints: ['Core', 'Balance'], avoidMovements: ['Heavy weights', 'High impact'] },
    undefined, 'team-wolf-pack'),
  makeClient('op-rubensr', 'Ruben Rodriguez Sr.', 'LOBO', '3006', 'haiku', 'op-rosa', 'op-ruben', true,
    { age: 60, height: "5'10\"", weight: 200, bodyFat: 30, trainingAge: '6 months', goals: ['heart health', 'strength', 'mobility'], readiness: 5, sleep: 5.5, stress: 5 },
    { split: 'Full Body', equipment: ['Dumbbell', 'Machine', 'Bodyweight'], sessionDuration: 40, daysPerWeek: 3, weakPoints: ['Shoulders', 'Knees'], avoidMovements: ['Heavy deadlifts', 'Running', 'Box jumps'] },
    undefined, 'team-wolf-pack'),

  // Edgar + Patty (WOLF PACK)
  // Edgar promoted to COMMANDER (opus) for beta testing — Apr 2026.
  makeClient('op-edgar', 'Edgar', 'VIPER', '3007', 'opus', 'op-patty', 'op-ruben', true,
    { age: 34, height: "5'10\"", weight: 195, bodyFat: 19, trainingAge: '8 years', goals: ['strength', 'athletic performance'], readiness: 8, sleep: 7.5, stress: 3 },
    { split: 'Push/Pull/Legs', equipment: ['Barbell', 'Dumbbell', 'Cable', 'Kettlebell'], sessionDuration: 75, daysPerWeek: 5, weakPoints: ['Overhead mobility'], avoidMovements: [] },
    undefined, 'team-wolf-pack'),
  makeClient('op-patty', 'Patty', 'SPARTAN', '3008', 'haiku', 'op-edgar', 'op-ruben', true,
    { age: 32, height: "5'5\"", weight: 135, bodyFat: 22, trainingAge: '3 years', goals: ['toning', 'endurance', 'flexibility'], readiness: 7, sleep: 7, stress: 4 },
    { split: 'Upper/Lower', equipment: ['Dumbbell', 'Cable', 'Bodyweight', 'Resistance Band'], sessionDuration: 50, daysPerWeek: 4, weakPoints: ['Upper body strength'], avoidMovements: [] },
    undefined, 'team-wolf-pack'),

  // Aldo + Jasmine (WOLF PACK)
  // Aldo promoted to COMMANDER (opus) for beta testing — Apr 2026.
  makeClient('op-aldo', 'Aldo', 'TITAN', '3009', 'opus', 'op-jasmine', 'op-ruben', true,
    { age: 28, height: "6'0\"", weight: 205, bodyFat: 16, trainingAge: '10 years', goals: ['hypertrophy', 'aesthetics'], readiness: 8, sleep: 8, stress: 2 },
    { split: 'Bro Split', equipment: ['Barbell', 'Dumbbell', 'Cable', 'Machine'], sessionDuration: 90, daysPerWeek: 6, weakPoints: ['Calves', 'Rear delts'], avoidMovements: [] },
    undefined, 'team-wolf-pack'),
  makeClient('op-jasmine', 'Jasmine', 'ATHENA', '3010', 'haiku', 'op-aldo', 'op-ruben', true,
    { age: 27, height: "5'7\"", weight: 130, bodyFat: 20, trainingAge: '4 years', goals: ['glute development', 'toning', 'strength'], readiness: 8, sleep: 7.5, stress: 3 },
    { split: 'Upper/Lower + Glute Day', equipment: ['Barbell', 'Dumbbell', 'Cable', 'Hip Thrust Bench'], sessionDuration: 60, daysPerWeek: 5, weakPoints: ['Upper body pulling'], avoidMovements: [] },
    undefined, 'team-wolf-pack'),

  // Arnold + Lynette (MADHEART)
  makeClient('op-arnold', 'Arnold', 'WARHORSE', '3011', 'sonnet', 'op-lynette', 'op-ruben', true,
    { age: 35, height: "5'11\"", weight: 210, bodyFat: 18, trainingAge: '10 years', goals: ['strength', 'hypertrophy', 'athletic performance'], readiness: 8, sleep: 7, stress: 3 },
    { split: 'Push/Pull/Legs', equipment: ['Barbell', 'Dumbbell', 'Cable', 'Kettlebell'], sessionDuration: 75, daysPerWeek: 5, weakPoints: ['Hamstrings', 'Mobility'], avoidMovements: [] },
    undefined, 'team-madheart'),
  makeClient('op-lynette', 'Lynette', 'SIREN', '3012', 'haiku', 'op-arnold', 'op-ruben', true,
    { age: 33, height: "5'5\"", weight: 140, bodyFat: 22, trainingAge: '3 years', goals: ['toning', 'endurance', 'weight loss'], readiness: 7, sleep: 7.5, stress: 4 },
    { split: 'Upper/Lower', equipment: ['Dumbbell', 'Cable', 'Bodyweight', 'Resistance Band'], sessionDuration: 50, daysPerWeek: 4, weakPoints: ['Core', 'Upper body strength'], avoidMovements: [] },
    undefined, 'team-madheart'),

  // ─── Junior Operators (PIN block 4xxx) ─────────────────────────────────
  // First Junior Operator profile. Trainer: RAMPAGE. Parents: IRONSIDE + Erika.
  // Routed to SOCCER_YOUTH_PROMPT — never the adult Marine DI tone.
  {
    id: 'op-poppy',
    name: 'Camila Cruz',
    callsign: 'POPPY',
    pin: '4001',
    role: 'client',
    tier: 'opus',                                   // COMMANDER tier — all junior operators get Opus 4.6 for safety-critical youth coaching (refusal scope, concussion protocol, RED-S detection benefit from the strongest model)
    tierLocked: true,                               // junior tiers are admin-controlled
    coupleWith: null,
    trainerId: 'op-ruben',
    teamId: 'team-wolf-pack',
    isJunior: true,
    juniorAge: 12,
    parentIds: ['op-efrain', 'op-erika'],

    profile: {
      age: 12,
      height: '4\'11"',                             // placeholder — confirm at intake
      weight: 90,                                   // placeholder — confirm at intake
      bodyFat: 0,                                   // sentinel: NEVER tracked or displayed for juniors
      trainingAge: '4 years',                       // soccer experience proxy
      goals: [
        'develop on-field aggression',
        'improve agility and change of direction',
        'refine running mechanics',
        'maintain ball-skill foundation',
      ],
      readiness: 8,
      sleep: 9,                                     // age-appropriate target 9-12 hrs
      stress: 3,
    },

    sportProfile: {
      sport: 'soccer',
      position: 'unsure',                           // coach to confirm
      level: 'mixed',
      yearsPlaying: 4,
      trainingDaysPerWeek: 3,                       // soccer practice days
      gameDay: 'sat',
      noTrainingDays: ['wed'],                      // dance day — explicit rest from soccer S&C
      trainingWindow: '6:00 PM',
      multiSport: true,
      otherSports: ['dance'],
      focusAreas: [
        'aggressive play / competitive mindset',
        'agility and change of direction',
        'running mechanics',
        'proficient and controlled movement',
        'ball-drill heavy programming',
      ],
      coachNotes:
        'Speed is a strength. Slightly undersized — leverage quickness over physicality. Ball skills are good — agility under pressure is the next layer. Running tech needs work — knee drive, foot strike, posture. Multi-sport (dance) is a positive: dance gives her body awareness and footwork that translates. Programming should be ball-heavy with movement quality cues — never punitive conditioning.',
      maturationStage: 'pre_phv',                   // typical for 12yo girl, confirm at next assessment
      estimatedPeakHeightVelocity: null,            // calculate via Mirwald in v2
    },

    juniorConsent: {
      parentSignatures: [],                         // populated on first parent login + e-signature
      participationConsent: false,
      dataConsent: false,
      emergencyContact: { name: '', relationship: '', phone: '' },
      pediatricianClearance: false,
      pediatricianClearanceDate: null,
    },

    juniorSafety: { events: [] },

    nutrition: {
      // Youth-appropriate range, NOT a deficit prescription.
      // Per UEFA 2021 / SDA 2014: girl 10-13 active = 2000-2400 kcal.
      targets: { calories: 2200, protein: 80, carbs: 300, fat: 75 },
      meals: {},
    },

    prs: [],                                        // Junior PR board uses sport-performance metrics — see commit 6
    injuries: [],
    workouts: {},
    dayTags: {},

    preferences: {
      split: 'Soccer S&C',
      equipment: ['cones', 'agility ladder', 'ball', 'bands', 'med-ball-light'],
      sessionDuration: 45,
      daysPerWeek: 3,                               // S&C sessions, not soccer practice
      weakPoints: ['running mechanics', 'agility under pressure'],
      avoidMovements: [],
    },
  },
];

export function getAccessibleOperators(userId: string, ops?: Operator[]): Operator[] {
  const source = ops || OPERATORS;
  const user = source.find((op) => op.id === userId);
  if (!user) return [];

  // Trainers see themselves + all operators (full admin access)
  if (user.role === 'trainer') {
    return source;
  }

  // Clients see themselves + their couple partner
  const accessibleUsers = [user];
  if (user.coupleWith) {
    const partner = source.find((op) => op.id === user.coupleWith);
    if (partner) {
      accessibleUsers.push(partner);
    }
  }

  // Parents (adult operators with juniors in parentIds) gain visibility into their juniors
  const juniors = getParentJuniors(user.id, source);
  for (const jr of juniors) {
    if (!accessibleUsers.find((a) => a.id === jr.id)) {
      accessibleUsers.push(jr);
    }
  }

  return accessibleUsers;
}

// Get a trainer's clients
export function getTrainerClients(trainerId: string, ops?: Operator[]): Operator[] {
  const source = ops || OPERATORS;
  return source.filter((op) => op.trainerId === trainerId);
}

// Get a client's trainer
export function getClientTrainer(clientId: string, ops?: Operator[]): Operator | undefined {
  const source = ops || OPERATORS;
  const client = source.find((op) => op.id === clientId);
  if (!client?.trainerId) return undefined;
  return source.find((op) => op.id === client.trainerId);
}

// Get all juniors a parent has visibility into
export function getParentJuniors(parentId: string, ops?: Operator[]): Operator[] {
  const source = ops || OPERATORS;
  return source.filter((op) => op.isJunior === true && op.parentIds?.includes(parentId));
}

// Get a junior's parents (adult operators)
export function getJuniorParents(juniorId: string, ops?: Operator[]): Operator[] {
  const source = ops || OPERATORS;
  const junior = source.find((op) => op.id === juniorId);
  if (!junior?.parentIds?.length) return [];
  return source.filter((op) => junior.parentIds!.includes(op.id));
}
