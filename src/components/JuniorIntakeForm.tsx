'use client';

// Junior Operator intake form (ages 10–18).
//
// Parallel to IntakeForm.tsx but youth-safe: NO body-fat field, NO max-rep
// PR entry, NO supplement questionnaire, NO caffeine question, NO calorie
// deficit / "lose weight" goals. Replaced with sport profile, focus areas,
// pediatrician clearance, and parent consent. The full youth-coaching
// boundary is enforced by SOCCER_YOUTH_PROMPT in src/app/api/gunny/route.ts;
// this form just collects the inputs SOCCER_YOUTH_PROMPT needs.
//
// onComplete returns an Operator with `sportProfile` + `juniorConsent`
// populated. Parent e-signature collection is Phase C — for v1 the consent
// step records participation/data consent + emergency contact only, and
// asks the trainer (RAMPAGE) to confirm parent signatures off-app.

import React, { useState, useCallback } from 'react';
import {
  Operator,
  SportProfile,
  JuniorConsent,
  SoccerPosition,
  CompetitionLevel,
  MaturationStage,
  DayOfWeek,
  formatHeightInput,
} from '@/lib/types';

interface JuniorIntakeFormProps {
  operator: Operator;
  onComplete: (updated: Operator) => void;
  onSkip?: () => void;
}

type JuniorStep =
  | 'welcome'
  | 'basics'
  | 'sport_profile'
  | 'focus_areas'
  | 'health'
  | 'consent'
  | 'review';

const STEP_ORDER: JuniorStep[] = [
  'welcome',
  'basics',
  'sport_profile',
  'focus_areas',
  'health',
  'consent',
  'review',
];

// Youth-safe goal options. Explicitly omitted: weight loss, body
// composition, "lean out". See docs/youth-soccer-corpus.md §11.
export const JUNIOR_GOAL_OPTIONS = [
  { id: 'speed', label: 'GET FASTER', desc: 'Sprint speed, acceleration, top-end' },
  { id: 'agility', label: 'IMPROVE AGILITY', desc: 'Change direction, reactive movement' },
  { id: 'strength', label: 'BUILD STRENGTH', desc: 'Age-appropriate, body-control first' },
  { id: 'mechanics', label: 'RUNNING MECHANICS', desc: 'Posture, stride, foot strike' },
  { id: 'aggression', label: 'COMPETE HARDER', desc: 'On-field confidence, physicality' },
  { id: 'ball_skills', label: 'BALL SKILLS', desc: 'Touch, control, 1v1' },
  { id: 'fitness', label: 'MATCH FITNESS', desc: 'Last the full game, recover faster' },
  { id: 'injury_prev', label: 'STAY HEALTHY', desc: 'FIFA 11+, ACL prevention, mobility' },
];

const POSITION_OPTIONS: { id: SoccerPosition; label: string; desc: string }[] = [
  { id: 'GK', label: 'GOALKEEPER', desc: 'Between the posts' },
  { id: 'CB', label: 'CENTRE BACK', desc: 'Defend the box' },
  { id: 'FB', label: 'FULL BACK', desc: 'Wide defender' },
  { id: 'CM', label: 'MIDFIELDER', desc: 'Central / box-to-box' },
  { id: 'W', label: 'WINGER', desc: 'Wide attacker' },
  { id: 'ST', label: 'STRIKER', desc: 'Number 9 / forward' },
  { id: 'unsure', label: 'NOT SURE YET', desc: 'Coach will help confirm' },
];

const LEVEL_OPTIONS: { id: CompetitionLevel; label: string; desc: string }[] = [
  { id: 'recreational', label: 'RECREATIONAL', desc: 'Local rec league' },
  { id: 'club', label: 'CLUB', desc: 'Travel / select club' },
  { id: 'academy', label: 'ACADEMY', desc: 'ECNL / MLS Next / development academy' },
  { id: 'high_school_varsity', label: 'HIGH SCHOOL VARSITY', desc: 'Varsity team' },
  { id: 'mixed', label: 'MIXED', desc: 'Club + school + tournaments' },
];

const DAY_OPTIONS: { id: DayOfWeek; label: string }[] = [
  { id: 'mon', label: 'MON' },
  { id: 'tue', label: 'TUE' },
  { id: 'wed', label: 'WED' },
  { id: 'thu', label: 'THU' },
  { id: 'fri', label: 'FRI' },
  { id: 'sat', label: 'SAT' },
  { id: 'sun', label: 'SUN' },
];

const MATURATION_OPTIONS: { id: MaturationStage; label: string; desc: string }[] = [
  { id: 'pre_phv', label: 'PRE-PHV', desc: 'Hasn’t hit growth spurt yet (typical: girls <11, boys <13)' },
  { id: 'peri_phv', label: 'PERI-PHV', desc: 'Currently in growth spurt — fast height gain, "awkward" coordination' },
  { id: 'post_phv', label: 'POST-PHV', desc: 'Growth spurt complete, height stable for 12+ months' },
  { id: 'unknown', label: 'NOT SURE', desc: 'Trainer will assess at first session' },
];

// Common youth athletic focus areas — checkbox list, athlete + parent pick
// what matters. Free-form additions handled in coachNotes.
const FOCUS_OPTIONS = [
  'Aggressive on-field play',
  'Agility / change of direction',
  'Running mechanics',
  'Ball mastery / touch',
  '1v1 confidence',
  'Decision-making under pressure',
  'Match fitness / endurance',
  'Strength / body control',
  'Mobility / flexibility',
  'Injury prevention (FIFA 11+ / ACL)',
];

export default function JuniorIntakeForm({ operator, onComplete, onSkip }: JuniorIntakeFormProps) {
  const [step, setStep] = useState<JuniorStep>('welcome');

  // Basics
  const [age, setAge] = useState(operator.profile.age || operator.juniorAge || 0);
  const [heightRaw, setHeightRaw] = useState('');
  const [weight, setWeight] = useState(operator.profile.weight || 0);

  // Sport profile
  const initialSp = operator.sportProfile;
  const [position, setPosition] = useState<SoccerPosition>(initialSp?.position || 'unsure');
  const [level, setLevel] = useState<CompetitionLevel>(initialSp?.level || 'club');
  const [yearsPlaying, setYearsPlaying] = useState<number>(initialSp?.yearsPlaying || 0);
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState<number>(initialSp?.trainingDaysPerWeek || 3);
  const [gameDay, setGameDay] = useState<DayOfWeek>(initialSp?.gameDay || 'sat');
  const [noTrainingDays, setNoTrainingDays] = useState<DayOfWeek[]>(initialSp?.noTrainingDays || []);
  const [trainingWindow, setTrainingWindow] = useState<string>(initialSp?.trainingWindow || '6:00 PM');
  const [multiSport, setMultiSport] = useState<boolean>(initialSp?.multiSport || false);
  const [otherSports, setOtherSports] = useState<string>(initialSp?.otherSports?.join(', ') || '');
  const [maturationStage, setMaturationStage] = useState<MaturationStage>(initialSp?.maturationStage || 'unknown');

  // Focus areas
  const [focusAreas, setFocusAreas] = useState<string[]>(initialSp?.focusAreas || []);
  const [coachNotes, setCoachNotes] = useState<string>(initialSp?.coachNotes || '');
  const [primaryGoals, setPrimaryGoals] = useState<string[]>([]);

  // Health
  const [hasCurrentPain, setHasCurrentPain] = useState<boolean>(false);
  const [painDescription, setPainDescription] = useState<string>('');
  const [pediatricianClearance, setPediatricianClearance] = useState<boolean>(false);
  const [pediatricianClearanceDate, setPediatricianClearanceDate] = useState<string>('');

  // Consent
  const [participationConsent, setParticipationConsent] = useState<boolean>(false);
  const [dataConsent, setDataConsent] = useState<boolean>(false);
  const [emergencyName, setEmergencyName] = useState<string>('');
  const [emergencyRelationship, setEmergencyRelationship] = useState<string>('');
  const [emergencyPhone, setEmergencyPhone] = useState<string>('');

  const stepIndex = STEP_ORDER.indexOf(step);
  const progress = Math.round((stepIndex / (STEP_ORDER.length - 1)) * 100);

  const nextStep = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };

  const prevStep = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const toggleNoTrainingDay = (day: DayOfWeek) => {
    setNoTrainingDays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]));
  };

  const toggleFocus = (item: string) => {
    setFocusAreas(prev => (prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]));
  };

  const toggleGoal = (id: string) => {
    setPrimaryGoals(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // Consent step gate — both checkboxes + emergency contact name + phone
  // required before review can submit. Parent e-signature collection is
  // Phase C; for v1 the trainer confirms parent consent off-app.
  const consentReady =
    participationConsent &&
    dataConsent &&
    emergencyName.trim().length > 0 &&
    emergencyPhone.trim().length > 0;

  const handleComplete = useCallback(() => {
    const formattedHeight = formatHeightInput(heightRaw) || operator.profile.height;
    const sportProfile: SportProfile = {
      sport: 'soccer',
      position,
      level,
      yearsPlaying,
      trainingDaysPerWeek,
      gameDay,
      noTrainingDays,
      trainingWindow,
      multiSport,
      otherSports: otherSports
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      focusAreas: [
        ...focusAreas,
        ...primaryGoals
          .map(id => JUNIOR_GOAL_OPTIONS.find(g => g.id === id)?.label)
          .filter((x): x is string => !!x),
      ],
      coachNotes,
      maturationStage,
      estimatedPeakHeightVelocity: null,
    };

    const juniorConsent: JuniorConsent = {
      // Parent signatures collected separately in Phase C parent dashboard.
      // For v1 the array stays empty here — trainer (RAMPAGE) confirms
      // off-app and Phase C will populate once parent operators e-sign.
      parentSignatures: operator.juniorConsent?.parentSignatures || [],
      participationConsent,
      dataConsent,
      emergencyContact: {
        name: emergencyName.trim(),
        relationship: emergencyRelationship.trim(),
        phone: emergencyPhone.trim(),
      },
      pediatricianClearance,
      pediatricianClearanceDate: pediatricianClearance ? pediatricianClearanceDate || null : null,
    };

    const goalLabels = primaryGoals
      .map(id => JUNIOR_GOAL_OPTIONS.find(g => g.id === id)?.label)
      .filter((x): x is string => !!x);

    const updated: Operator = {
      ...operator,
      profile: {
        ...operator.profile,
        age,
        height: formattedHeight,
        weight,
        // bodyFat intentionally NOT collected for juniors — see
        // docs/youth-soccer-corpus.md §6 (body-comp tracking is hazardous
        // in youth and elevates eating-disorder risk).
        goals: goalLabels,
        intakeCompleted: true,
        intakeCompletedDate: new Date().toISOString(),
      },
      juniorAge: age,
      sportProfile,
      juniorConsent,
      // Build a starter injury entry if athlete reported current pain so
      // the trainer + Gunny can see it on day one.
      injuries: [
        ...(operator.injuries || []),
        ...(hasCurrentPain && painDescription.trim()
          ? [{
              id: `injury-junior-intake-${Date.now()}`,
              name: painDescription.trim(),
              status: 'active' as const,
              notes: 'Reported during junior intake — pediatrician evaluation recommended before training.',
              restrictions: [],
            }]
          : []),
      ],
    };

    onComplete(updated);
  }, [
    operator,
    age,
    heightRaw,
    weight,
    position,
    level,
    yearsPlaying,
    trainingDaysPerWeek,
    gameDay,
    noTrainingDays,
    trainingWindow,
    multiSport,
    otherSports,
    focusAreas,
    primaryGoals,
    coachNotes,
    maturationStage,
    hasCurrentPain,
    painDescription,
    pediatricianClearance,
    pediatricianClearanceDate,
    participationConsent,
    dataConsent,
    emergencyName,
    emergencyRelationship,
    emergencyPhone,
    onComplete,
  ]);

  const s: Record<string, React.CSSProperties> = {
    container: { width: '100%', maxWidth: 600, margin: '0 auto', padding: '20px', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace" },
    header: { textAlign: 'center', marginBottom: 24 },
    title: { fontFamily: 'Orbitron, sans-serif', fontSize: 18, color: '#00ff41', letterSpacing: 2, marginBottom: 8 },
    subtitle: { fontSize: 12, color: '#888', letterSpacing: 1 },
    badge: { display: 'inline-block', marginTop: 8, padding: '2px 10px', background: '#0a1a0a', border: '1px solid #00ff41', color: '#00ff41', fontSize: 10, letterSpacing: 1, borderRadius: 3 },
    progressBar: { width: '100%', height: 4, background: '#1a1a1a', borderRadius: 2, marginBottom: 24, overflow: 'hidden' },
    progressFill: { height: '100%', background: '#00ff41', borderRadius: 2, transition: 'width 0.3s ease' },
    stepTitle: { fontFamily: 'Orbitron, sans-serif', fontSize: 14, color: '#00ff41', letterSpacing: 1, marginBottom: 16 },
    label: { display: 'block', fontSize: 11, color: '#888', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' as const },
    input: { width: '100%', padding: '10px 12px', background: '#0a0a0a', border: '1px solid #333', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: 14, borderRadius: 4, marginBottom: 16, outline: 'none', boxSizing: 'border-box' as const },
    textarea: { width: '100%', minHeight: 80, padding: '10px 12px', background: '#0a0a0a', border: '1px solid #333', color: '#e0e0e0', fontFamily: "'Share Tech Mono', monospace", fontSize: 13, borderRadius: 4, marginBottom: 16, outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const },
    optionGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 },
    optionCol: { display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 16 },
    optionBtn: { padding: '12px 8px', background: '#0a0a0a', border: '1px solid #333', color: '#888', fontFamily: "'Share Tech Mono', monospace", fontSize: 11, borderRadius: 4, cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.2s' },
    optionBtnActive: { background: '#0a1a0a', border: '1px solid #00ff41', color: '#00ff41' },
    optionCard: { padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s' },
    optionCardActive: { background: '#0a1a0a', border: '1px solid #00ff41' },
    optionCardLabel: { fontSize: 12, color: '#e0e0e0', letterSpacing: 1, fontWeight: 700, marginBottom: 4 },
    optionCardLabelActive: { color: '#00ff41' },
    optionCardDesc: { fontSize: 11, color: '#888', lineHeight: 1.4 },
    dayRow: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 16 },
    dayBtn: { padding: '8px 4px', background: '#0a0a0a', border: '1px solid #333', color: '#888', fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: 1, borderRadius: 3, cursor: 'pointer', textAlign: 'center' as const },
    dayBtnActive: { background: '#0a1a0a', border: '1px solid #00ff41', color: '#00ff41' },
    checkboxRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, marginBottom: 8, cursor: 'pointer' },
    checkboxRowActive: { background: '#0a1a0a', border: '1px solid #00ff41' },
    checkbox: { marginTop: 2, accentColor: '#00ff41', cursor: 'pointer' },
    consentBlock: { padding: '14px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, marginBottom: 12 },
    consentText: { fontSize: 12, color: '#ccc', lineHeight: 1.6, marginBottom: 12 },
    navRow: { display: 'flex', justifyContent: 'space-between', marginTop: 24, gap: 12 },
    btnPrimary: { flex: 1, padding: '12px', background: '#00ff41', color: '#030303', border: 'none', fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 1, borderRadius: 4, cursor: 'pointer' },
    btnPrimaryDisabled: { flex: 1, padding: '12px', background: '#1a1a1a', color: '#555', border: 'none', fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700, letterSpacing: 1, borderRadius: 4, cursor: 'not-allowed' },
    btnSecondary: { flex: 1, padding: '12px', background: 'transparent', color: '#888', border: '1px solid #333', fontFamily: "'Share Tech Mono', monospace", fontSize: 12, borderRadius: 4, cursor: 'pointer' },
    reviewSection: { padding: '12px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: 4, marginBottom: 12 },
    reviewLabel: { fontSize: 10, color: '#666', letterSpacing: 1, textTransform: 'uppercase' as const },
    reviewValue: { fontSize: 14, color: '#e0e0e0', marginTop: 4 },
    note: { fontSize: 11, color: '#666', lineHeight: 1.5, marginTop: 8, fontStyle: 'italic' },
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={s.title}>JUNIOR OPERATOR INTAKE</div>
        <div style={s.subtitle}>OPERATOR: {operator.callsign}</div>
        <div style={s.badge}>YOUTH PROGRAM (10–18)</div>
      </div>
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${progress}%` }} />
      </div>

      {step === 'welcome' && (
        <div>
          <div style={s.stepTitle}>WELCOME, {operator.callsign}</div>
          <p style={{ color: '#ccc', lineHeight: 1.6, fontSize: 13, marginBottom: 16 }}>
            Welcome to GUNS UP. Let&apos;s get to know you so we can build a smart program for the field.
          </p>
          <p style={{ color: '#ccc', lineHeight: 1.6, fontSize: 13, marginBottom: 16 }}>
            Heads up — your parents can see your training log and our conversations. That&apos;s part of how the Junior Operator program works. So when you talk to Gunny, talk how you&apos;d talk to a coach in front of your parents.
          </p>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 24 }}>
            Estimated time: 4–6 minutes
          </p>
          <div style={s.navRow}>
            {onSkip && <button style={s.btnSecondary} onClick={onSkip}>SKIP FOR NOW</button>}
            <button style={s.btnPrimary} onClick={nextStep}>BEGIN</button>
          </div>
        </div>
      )}

      {step === 'basics' && (
        <div>
          <div style={s.stepTitle}>BASICS</div>
          <label style={s.label}>AGE</label>
          <input type="number" style={s.input} value={age || ''} onChange={e => setAge(parseInt(e.target.value) || 0)} placeholder="12" min={10} max={18} />
          <label style={s.label}>HEIGHT (type digits, e.g. 411 for 4&apos;11&quot;)</label>
          <input type="text" style={s.input} value={heightRaw} onChange={e => setHeightRaw(e.target.value)} onBlur={() => setHeightRaw(formatHeightInput(heightRaw))} placeholder="411" />
          <label style={s.label}>WEIGHT (lbs, optional but helps with hydration math)</label>
          <input type="number" style={s.input} value={weight || ''} onChange={e => setWeight(parseFloat(e.target.value) || 0)} placeholder="90" />
          <p style={s.note}>
            We don&apos;t track body-fat % or any body-composition number for junior operators. Performance is what we measure — speed, jump, endurance, recovery.
          </p>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'sport_profile' && (
        <div>
          <div style={s.stepTitle}>SPORT PROFILE — SOCCER</div>

          <label style={s.label}>POSITION</label>
          <div style={{ ...s.optionGrid, gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {POSITION_OPTIONS.map(p => (
              <div
                key={p.id}
                style={{ ...s.optionCard, ...(position === p.id ? s.optionCardActive : {}) }}
                onClick={() => setPosition(p.id)}
              >
                <div style={{ ...s.optionCardLabel, ...(position === p.id ? s.optionCardLabelActive : {}) }}>{p.label}</div>
                <div style={s.optionCardDesc}>{p.desc}</div>
              </div>
            ))}
          </div>

          <label style={s.label}>COMPETITION LEVEL</label>
          <div style={s.optionCol}>
            {LEVEL_OPTIONS.map(l => (
              <div
                key={l.id}
                style={{ ...s.optionCard, ...(level === l.id ? s.optionCardActive : {}) }}
                onClick={() => setLevel(l.id)}
              >
                <div style={{ ...s.optionCardLabel, ...(level === l.id ? s.optionCardLabelActive : {}) }}>{l.label}</div>
                <div style={s.optionCardDesc}>{l.desc}</div>
              </div>
            ))}
          </div>

          <label style={s.label}>YEARS PLAYING SOCCER</label>
          <input type="number" style={s.input} value={yearsPlaying || ''} onChange={e => setYearsPlaying(parseInt(e.target.value) || 0)} placeholder="4" min={0} max={18} />

          <label style={s.label}>SOCCER PRACTICES PER WEEK (with team, not GUNS UP)</label>
          <input type="number" style={s.input} value={trainingDaysPerWeek || ''} onChange={e => setTrainingDaysPerWeek(parseInt(e.target.value) || 0)} placeholder="3" min={0} max={7} />

          <label style={s.label}>GAME DAY</label>
          <div style={s.dayRow}>
            {DAY_OPTIONS.map(d => (
              <div
                key={d.id}
                style={{ ...s.dayBtn, ...(gameDay === d.id ? s.dayBtnActive : {}) }}
                onClick={() => setGameDay(d.id)}
              >
                {d.label}
              </div>
            ))}
          </div>

          <label style={s.label}>NO-S&amp;C DAYS (other sports / rest — tap to toggle)</label>
          <div style={s.dayRow}>
            {DAY_OPTIONS.map(d => (
              <div
                key={d.id}
                style={{ ...s.dayBtn, ...(noTrainingDays.includes(d.id) ? s.dayBtnActive : {}) }}
                onClick={() => toggleNoTrainingDay(d.id)}
              >
                {d.label}
              </div>
            ))}
          </div>

          <label style={s.label}>TRAINING WINDOW (when can you usually train?)</label>
          <input type="text" style={s.input} value={trainingWindow} onChange={e => setTrainingWindow(e.target.value)} placeholder="6:00 PM" />

          <label style={s.label}>OTHER SPORTS YOU PLAY (multi-sport is encouraged)</label>
          <div style={{ ...s.checkboxRow, ...(multiSport ? s.checkboxRowActive : {}) }} onClick={() => setMultiSport(!multiSport)}>
            <input type="checkbox" style={s.checkbox} checked={multiSport} readOnly />
            <span style={{ fontSize: 12 }}>I play another sport too</span>
          </div>
          {multiSport && (
            <input type="text" style={s.input} value={otherSports} onChange={e => setOtherSports(e.target.value)} placeholder="dance, basketball, track" />
          )}

          <label style={s.label}>MATURATION STAGE (trainer can update later)</label>
          <div style={s.optionCol}>
            {MATURATION_OPTIONS.map(m => (
              <div
                key={m.id}
                style={{ ...s.optionCard, ...(maturationStage === m.id ? s.optionCardActive : {}) }}
                onClick={() => setMaturationStage(m.id)}
              >
                <div style={{ ...s.optionCardLabel, ...(maturationStage === m.id ? s.optionCardLabelActive : {}) }}>{m.label}</div>
                <div style={s.optionCardDesc}>{m.desc}</div>
              </div>
            ))}
          </div>

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'focus_areas' && (
        <div>
          <div style={s.stepTitle}>WHAT DO YOU WANT TO WORK ON?</div>
          <p style={s.note}>Pick as many as apply — your trainer will balance them in your program.</p>
          <div style={s.optionCol}>
            {FOCUS_OPTIONS.map(f => (
              <div
                key={f}
                style={{ ...s.checkboxRow, ...(focusAreas.includes(f) ? s.checkboxRowActive : {}) }}
                onClick={() => toggleFocus(f)}
              >
                <input type="checkbox" style={s.checkbox} checked={focusAreas.includes(f)} readOnly />
                <span style={{ fontSize: 12, color: focusAreas.includes(f) ? '#00ff41' : '#ccc' }}>{f}</span>
              </div>
            ))}
          </div>

          <label style={s.label}>PRIMARY GOALS</label>
          <div style={s.optionGrid}>
            {JUNIOR_GOAL_OPTIONS.map(g => (
              <div
                key={g.id}
                style={{ ...s.optionCard, ...(primaryGoals.includes(g.id) ? s.optionCardActive : {}) }}
                onClick={() => toggleGoal(g.id)}
              >
                <div style={{ ...s.optionCardLabel, ...(primaryGoals.includes(g.id) ? s.optionCardLabelActive : {}) }}>{g.label}</div>
                <div style={s.optionCardDesc}>{g.desc}</div>
              </div>
            ))}
          </div>

          <label style={s.label}>COACH / PARENT NOTES (optional — anything Gunny should know)</label>
          <textarea style={s.textarea} value={coachNotes} onChange={e => setCoachNotes(e.target.value)} placeholder="e.g. Speed is a strength. Slightly undersized — leverage quickness over physicality. Running tech needs work — knee drive, foot strike, posture." />

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'health' && (
        <div>
          <div style={s.stepTitle}>HEALTH SCREEN</div>

          <label style={s.label}>ANY CURRENT PAIN OR INJURY?</label>
          <div style={{ ...s.checkboxRow, ...(hasCurrentPain ? s.checkboxRowActive : {}) }} onClick={() => setHasCurrentPain(!hasCurrentPain)}>
            <input type="checkbox" style={s.checkbox} checked={hasCurrentPain} readOnly />
            <span style={{ fontSize: 12 }}>Yes, something hurts right now</span>
          </div>
          {hasCurrentPain && (
            <>
              <textarea style={s.textarea} value={painDescription} onChange={e => setPainDescription(e.target.value)} placeholder="e.g. left knee aches after games, started 2 weeks ago" />
              <p style={s.note}>
                Gunny will not coach you through pain. Anything that hurts gets a pediatrician or athletic trainer first — your trainer will follow up.
              </p>
            </>
          )}

          <label style={s.label}>PEDIATRICIAN CLEARANCE</label>
          <div style={{ ...s.checkboxRow, ...(pediatricianClearance ? s.checkboxRowActive : {}) }} onClick={() => setPediatricianClearance(!pediatricianClearance)}>
            <input type="checkbox" style={s.checkbox} checked={pediatricianClearance} readOnly />
            <span style={{ fontSize: 12 }}>Pediatrician has cleared this athlete for sport</span>
          </div>
          {pediatricianClearance && (
            <>
              <label style={s.label}>CLEARANCE DATE (optional)</label>
              <input type="date" style={s.input} value={pediatricianClearanceDate} onChange={e => setPediatricianClearanceDate(e.target.value)} />
            </>
          )}

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={nextStep}>NEXT</button>
          </div>
        </div>
      )}

      {step === 'consent' && (
        <div>
          <div style={s.stepTitle}>PARENT CONSENT</div>
          <p style={s.note}>
            For a junior operator to participate, we need a parent or guardian to confirm consent. Both checkboxes are required, plus an emergency contact.
          </p>

          <div style={s.consentBlock}>
            <div style={s.consentText}>
              I confirm my junior&apos;s participation in the GUNS UP Junior Operator program. I understand Gunny is an AI coach, not a clinician — any pain, injury, suspected concussion, or mental-health concern is referred to a qualified medical professional, not coached. I also understand that programming is age-appropriate and follows published youth-soccer guidelines (FIFA 11+, NSCA youth resistance training, AAP/AOSSM workload caps).
            </div>
            <div style={{ ...s.checkboxRow, ...(participationConsent ? s.checkboxRowActive : {}) }} onClick={() => setParticipationConsent(!participationConsent)}>
              <input type="checkbox" style={s.checkbox} checked={participationConsent} readOnly />
              <span style={{ fontSize: 12 }}>PARTICIPATION CONSENT</span>
            </div>
          </div>

          <div style={s.consentBlock}>
            <div style={s.consentText}>
              I consent to GUNS UP storing my junior&apos;s training log, Gunny chat history, sport profile, and health-screen answers. I understand I have full visibility into the account via my parent dashboard, and I can request deletion at any time.
            </div>
            <div style={{ ...s.checkboxRow, ...(dataConsent ? s.checkboxRowActive : {}) }} onClick={() => setDataConsent(!dataConsent)}>
              <input type="checkbox" style={s.checkbox} checked={dataConsent} readOnly />
              <span style={{ fontSize: 12 }}>DATA CONSENT</span>
            </div>
          </div>

          <label style={s.label}>EMERGENCY CONTACT — NAME *</label>
          <input type="text" style={s.input} value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Full name" />

          <label style={s.label}>RELATIONSHIP</label>
          <input type="text" style={s.input} value={emergencyRelationship} onChange={e => setEmergencyRelationship(e.target.value)} placeholder="Mother / Father / Guardian" />

          <label style={s.label}>PHONE *</label>
          <input type="tel" style={s.input} value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="(555) 123-4567" />

          <p style={s.note}>
            Parent e-signature collection is part of the parent dashboard (coming next phase). For now, your trainer will confirm parent consent off-app.
          </p>

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button
              style={consentReady ? s.btnPrimary : s.btnPrimaryDisabled}
              disabled={!consentReady}
              onClick={() => consentReady && nextStep()}
            >
              REVIEW
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={s.stepTitle}>REVIEW</div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Operator</div>
            <div style={s.reviewValue}>{operator.callsign} — age {age}</div>
          </div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Sport Profile</div>
            <div style={s.reviewValue}>
              {POSITION_OPTIONS.find(p => p.id === position)?.label} · {LEVEL_OPTIONS.find(l => l.id === level)?.label} · {yearsPlaying} yrs
            </div>
            <div style={{ ...s.reviewValue, fontSize: 12, color: '#888' }}>
              Game day: {gameDay.toUpperCase()} · S&amp;C off: {noTrainingDays.length ? noTrainingDays.map(d => d.toUpperCase()).join(', ') : 'none'}
            </div>
            {multiSport && (
              <div style={{ ...s.reviewValue, fontSize: 12, color: '#888' }}>
                Also: {otherSports || 'multi-sport (unspecified)'}
              </div>
            )}
          </div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Maturation</div>
            <div style={s.reviewValue}>{MATURATION_OPTIONS.find(m => m.id === maturationStage)?.label}</div>
          </div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Focus Areas</div>
            <div style={s.reviewValue}>{focusAreas.length ? focusAreas.join(' · ') : 'general athletic development'}</div>
          </div>

          {primaryGoals.length > 0 && (
            <div style={s.reviewSection}>
              <div style={s.reviewLabel}>Goals</div>
              <div style={s.reviewValue}>
                {primaryGoals
                  .map(id => JUNIOR_GOAL_OPTIONS.find(g => g.id === id)?.label)
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          )}

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Health</div>
            <div style={s.reviewValue}>
              {hasCurrentPain ? `Pain: ${painDescription || 'unspecified — trainer will follow up'}` : 'No current pain reported'}
            </div>
            <div style={{ ...s.reviewValue, fontSize: 12, color: pediatricianClearance ? '#00ff41' : '#888' }}>
              Pediatrician clearance: {pediatricianClearance ? `YES${pediatricianClearanceDate ? ` (${pediatricianClearanceDate})` : ''}` : 'not on file'}
            </div>
          </div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>Consent</div>
            <div style={s.reviewValue}>Participation: {participationConsent ? '✓' : '✗'} · Data: {dataConsent ? '✓' : '✗'}</div>
            <div style={{ ...s.reviewValue, fontSize: 12, color: '#888' }}>
              Emergency: {emergencyName} {emergencyRelationship && `(${emergencyRelationship})`} — {emergencyPhone}
            </div>
          </div>

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>BACK</button>
            <button style={s.btnPrimary} onClick={handleComplete}>SUBMIT INTAKE</button>
          </div>
        </div>
      )}
    </div>
  );
}
