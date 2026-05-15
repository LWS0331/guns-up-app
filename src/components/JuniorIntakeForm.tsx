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
  Sport,
  SportProfile,
  JuniorConsent,
  SoccerPosition,
  CompetitionLevel,
  MaturationStage,
  DayOfWeek,
  formatHeightInput,
} from '@/lib/types';
import { useLanguage } from '@/lib/i18n';

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
// `label` is the canonical English value stored in DB (sportProfile
// focusAreas + operator goals are seeded from this). `labelKey` is the
// i18n key resolved at render time for display.
export const JUNIOR_GOAL_OPTIONS = [
  { id: 'speed', label: 'GET FASTER', labelKey: 'junior.goal.speed.label', descKey: 'junior.goal.speed.desc' },
  { id: 'agility', label: 'IMPROVE AGILITY', labelKey: 'junior.goal.agility.label', descKey: 'junior.goal.agility.desc' },
  { id: 'strength', label: 'BUILD STRENGTH', labelKey: 'junior.goal.strength.label', descKey: 'junior.goal.strength.desc' },
  { id: 'mechanics', label: 'RUNNING MECHANICS', labelKey: 'junior.goal.mechanics.label', descKey: 'junior.goal.mechanics.desc' },
  { id: 'aggression', label: 'COMPETE HARDER', labelKey: 'junior.goal.aggression.label', descKey: 'junior.goal.aggression.desc' },
  { id: 'ball_skills', label: 'BALL SKILLS', labelKey: 'junior.goal.ball_skills.label', descKey: 'junior.goal.ball_skills.desc' },
  { id: 'fitness', label: 'MATCH FITNESS', labelKey: 'junior.goal.fitness.label', descKey: 'junior.goal.fitness.desc' },
  { id: 'injury_prev', label: 'STAY HEALTHY', labelKey: 'junior.goal.injury_prev.label', descKey: 'junior.goal.injury_prev.desc' },
];

const POSITION_OPTIONS: { id: SoccerPosition; labelKey: string; descKey: string }[] = [
  { id: 'GK', labelKey: 'junior.pos.gk.label', descKey: 'junior.pos.gk.desc' },
  { id: 'CB', labelKey: 'junior.pos.cb.label', descKey: 'junior.pos.cb.desc' },
  { id: 'FB', labelKey: 'junior.pos.fb.label', descKey: 'junior.pos.fb.desc' },
  { id: 'CM', labelKey: 'junior.pos.cm.label', descKey: 'junior.pos.cm.desc' },
  { id: 'W', labelKey: 'junior.pos.w.label', descKey: 'junior.pos.w.desc' },
  { id: 'ST', labelKey: 'junior.pos.st.label', descKey: 'junior.pos.st.desc' },
  { id: 'unsure', labelKey: 'junior.pos.unsure.label', descKey: 'junior.pos.unsure.desc' },
];

// Football position roles. Curated set of 11 broad roles instead of
// surfacing all 34 specific positions from the corpus — youth athletes
// (10-18) typically know their general role but not the specific
// alignment (e.g. they know "Wide Receiver", not "X-receiver vs Z").
// The football corpus has 34 specific position keys; the route layer
// passes the kid's broad role to Gunny and lets Gunny ask follow-ups
// about the specific alignment when relevant. Storing the broad role
// keeps the intake friction low.
//
// `id` values are deliberately distinct from the corpus position_keys
// so the route layer can map broad → specific (or skip the filter
// when the kid picked unsure / multi-position).
export type FootballPositionRole =
  | 'qb' | 'rb' | 'wr' | 'te' | 'ol' | 'dl' | 'lb' | 'db'
  | 'safety' | 'st' | 'ath' | 'unsure';

const FOOTBALL_POSITION_OPTIONS: { id: FootballPositionRole; labelKey: string; descKey: string }[] = [
  { id: 'qb',     labelKey: 'junior.fb_pos.qb.label',     descKey: 'junior.fb_pos.qb.desc' },
  { id: 'rb',     labelKey: 'junior.fb_pos.rb.label',     descKey: 'junior.fb_pos.rb.desc' },
  { id: 'wr',     labelKey: 'junior.fb_pos.wr.label',     descKey: 'junior.fb_pos.wr.desc' },
  { id: 'te',     labelKey: 'junior.fb_pos.te.label',     descKey: 'junior.fb_pos.te.desc' },
  { id: 'ol',     labelKey: 'junior.fb_pos.ol.label',     descKey: 'junior.fb_pos.ol.desc' },
  { id: 'dl',     labelKey: 'junior.fb_pos.dl.label',     descKey: 'junior.fb_pos.dl.desc' },
  { id: 'lb',     labelKey: 'junior.fb_pos.lb.label',     descKey: 'junior.fb_pos.lb.desc' },
  { id: 'db',     labelKey: 'junior.fb_pos.db.label',     descKey: 'junior.fb_pos.db.desc' },
  { id: 'safety', labelKey: 'junior.fb_pos.safety.label', descKey: 'junior.fb_pos.safety.desc' },
  { id: 'st',     labelKey: 'junior.fb_pos.st.label',     descKey: 'junior.fb_pos.st.desc' },
  { id: 'ath',   labelKey: 'junior.fb_pos.ath.label',    descKey: 'junior.fb_pos.ath.desc' },
  { id: 'unsure', labelKey: 'junior.fb_pos.unsure.label', descKey: 'junior.fb_pos.unsure.desc' },
];

const SPORT_OPTIONS: { id: Sport; labelKey: string; descKey: string }[] = [
  { id: 'soccer',   labelKey: 'junior.sport.soccer.label',   descKey: 'junior.sport.soccer.desc' },
  { id: 'football', labelKey: 'junior.sport.football.label', descKey: 'junior.sport.football.desc' },
];

const LEVEL_OPTIONS: { id: CompetitionLevel; labelKey: string; descKey: string }[] = [
  { id: 'recreational', labelKey: 'junior.lvl.recreational.label', descKey: 'junior.lvl.recreational.desc' },
  { id: 'club', labelKey: 'junior.lvl.club.label', descKey: 'junior.lvl.club.desc' },
  { id: 'academy', labelKey: 'junior.lvl.academy.label', descKey: 'junior.lvl.academy.desc' },
  { id: 'high_school_varsity', labelKey: 'junior.lvl.high_school.label', descKey: 'junior.lvl.high_school.desc' },
  { id: 'mixed', labelKey: 'junior.lvl.mixed.label', descKey: 'junior.lvl.mixed.desc' },
];

const DAY_OPTIONS: { id: DayOfWeek; labelKey: string }[] = [
  { id: 'mon', labelKey: 'junior.day.mon' },
  { id: 'tue', labelKey: 'junior.day.tue' },
  { id: 'wed', labelKey: 'junior.day.wed' },
  { id: 'thu', labelKey: 'junior.day.thu' },
  { id: 'fri', labelKey: 'junior.day.fri' },
  { id: 'sat', labelKey: 'junior.day.sat' },
  { id: 'sun', labelKey: 'junior.day.sun' },
];

const MATURATION_OPTIONS: { id: MaturationStage; labelKey: string; descKey: string }[] = [
  { id: 'pre_phv', labelKey: 'junior.mat.pre_phv.label', descKey: 'junior.mat.pre_phv.desc' },
  { id: 'peri_phv', labelKey: 'junior.mat.peri_phv.label', descKey: 'junior.mat.peri_phv.desc' },
  { id: 'post_phv', labelKey: 'junior.mat.post_phv.label', descKey: 'junior.mat.post_phv.desc' },
  { id: 'unknown', labelKey: 'junior.mat.unknown.label', descKey: 'junior.mat.unknown.desc' },
];

// Common youth athletic focus areas — checkbox list, athlete + parent pick
// what matters. Free-form additions handled in coachNotes. Stored value
// is the English label; translated for display.
const FOCUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'Aggressive on-field play', labelKey: 'junior.focus.aggressive' },
  { value: 'Agility / change of direction', labelKey: 'junior.focus.agility' },
  { value: 'Running mechanics', labelKey: 'junior.focus.mechanics' },
  { value: 'Ball mastery / touch', labelKey: 'junior.focus.ball_mastery' },
  { value: '1v1 confidence', labelKey: 'junior.focus.confidence' },
  { value: 'Decision-making under pressure', labelKey: 'junior.focus.decisions' },
  { value: 'Match fitness / endurance', labelKey: 'junior.focus.match_fitness' },
  { value: 'Strength / body control', labelKey: 'junior.focus.strength' },
  { value: 'Mobility / flexibility', labelKey: 'junior.focus.mobility' },
  { value: 'Injury prevention (FIFA 11+ / ACL)', labelKey: 'junior.focus.injury_prev' },
];

export default function JuniorIntakeForm({ operator, onComplete, onSkip }: JuniorIntakeFormProps) {
  const { t } = useLanguage();
  const [step, setStep] = useState<JuniorStep>('welcome');

  // Basics
  const [age, setAge] = useState(operator.profile.age || operator.juniorAge || 0);
  const [heightRaw, setHeightRaw] = useState('');
  const [weight, setWeight] = useState(operator.profile.weight || 0);

  // Sport profile
  const initialSp = operator.sportProfile;
  // Sport selector — defaults to soccer for backward compat. Pre-existing
  // operators who already saved a sportProfile keep whichever sport they
  // had (soccer for everyone today).
  const [sport, setSport] = useState<Sport>(initialSp?.sport || 'soccer');
  const [position, setPosition] = useState<SoccerPosition>(initialSp?.position || 'unsure');
  // Football position role (broad). Persisted to sportProfile.footballPosition
  // when sport === 'football'. The route layer maps this broad role to
  // the corpus's 34 specific position_keys when filtering.
  const [footballPosition, setFootballPosition] = useState<FootballPositionRole>(
    (initialSp?.footballPosition as FootballPositionRole) || 'unsure',
  );
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
    // Build the sport profile with sport-aware position data.
    //   - Soccer: position is the SoccerPosition enum (GK/CB/FB/CM/W/ST/unsure).
    //     footballPosition is left undefined so consumers can branch on
    //     `sport` rather than checking both fields.
    //   - Football: position stays at 'unsure' as a placeholder (the
    //     soccer field is required by the type) and footballPosition
    //     carries the broad role. The gunny route checks sport first
    //     and only reads footballPosition when sport === 'football'.
    const sportProfile: SportProfile = {
      sport,
      position: sport === 'soccer' ? position : 'unsure',
      footballPosition: sport === 'football' ? footballPosition : undefined,
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
    sport,
    position,
    footballPosition,
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
        <div style={s.title}>{t('junior.title')}</div>
        <div style={s.subtitle}>{t('junior.operator_label')} {operator.callsign}</div>
        <div style={s.badge}>{t('junior.youth_badge')}</div>
      </div>
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${progress}%` }} />
      </div>

      {step === 'welcome' && (
        <div>
          <div style={s.stepTitle}>{t('junior.welcome_step').replace('{callsign}', operator.callsign)}</div>
          <p style={{ color: '#ccc', lineHeight: 1.6, fontSize: 13, marginBottom: 16 }}>
            {t('junior.welcome_intro')}
          </p>
          <p style={{ color: '#ccc', lineHeight: 1.6, fontSize: 13, marginBottom: 16 }}>
            {t('junior.welcome_transparency')}
          </p>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 24 }}>
            {t('junior.welcome_time')}
          </p>
          <div style={s.navRow}>
            {onSkip && <button style={s.btnSecondary} onClick={onSkip}>{t('junior.skip')}</button>}
            <button style={s.btnPrimary} onClick={nextStep}>{t('junior.begin')}</button>
          </div>
        </div>
      )}

      {step === 'basics' && (
        <div>
          <div style={s.stepTitle}>{t('junior.basics')}</div>
          <label style={s.label}>{t('junior.age')}</label>
          <input type="number" style={s.input} value={age || ''} onChange={e => setAge(parseInt(e.target.value) || 0)} placeholder={t('junior.age_placeholder')} min={10} max={18} />
          <label style={s.label}>{t('junior.height_label')}</label>
          <input type="text" style={s.input} value={heightRaw} onChange={e => setHeightRaw(e.target.value)} onBlur={() => setHeightRaw(formatHeightInput(heightRaw))} placeholder={t('junior.height_placeholder')} />
          <label style={s.label}>{t('junior.weight_label')}</label>
          <input type="number" style={s.input} value={weight || ''} onChange={e => setWeight(parseFloat(e.target.value) || 0)} placeholder={t('junior.weight_placeholder')} />
          <p style={s.note}>
            {t('junior.no_body_comp_note')}
          </p>
          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('junior.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('junior.next')}</button>
          </div>
        </div>
      )}

      {step === 'sport_profile' && (
        <div>
          <div style={s.stepTitle}>{t('junior.sport_profile')}</div>

          {/* Sport picker — soccer / football. Drives which corpus
              Gunny loads (youth-soccer.md vs youth-football.md) and
              which position-selector renders below. */}
          <label style={s.label}>{t('junior.sport_label')}</label>
          <div style={{ ...s.optionGrid, gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {SPORT_OPTIONS.map(sp => (
              <div
                key={sp.id}
                style={{ ...s.optionCard, ...(sport === sp.id ? s.optionCardActive : {}) }}
                onClick={() => setSport(sp.id)}
              >
                <div style={{ ...s.optionCardLabel, ...(sport === sp.id ? s.optionCardLabelActive : {}) }}>{t(sp.labelKey)}</div>
                <div style={s.optionCardDesc}>{t(sp.descKey)}</div>
              </div>
            ))}
          </div>

          <label style={s.label}>{t('junior.position')}</label>
          <div style={{ ...s.optionGrid, gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {(sport === 'football' ? FOOTBALL_POSITION_OPTIONS : POSITION_OPTIONS).map(p => {
              const isActive = sport === 'football'
                ? footballPosition === p.id
                : position === p.id;
              return (
              <div
                key={p.id}
                style={{ ...s.optionCard, ...(isActive ? s.optionCardActive : {}) }}
                onClick={() => {
                  if (sport === 'football') {
                    setFootballPosition(p.id as FootballPositionRole);
                  } else {
                    setPosition(p.id as SoccerPosition);
                  }
                }}
              >
                <div style={{ ...s.optionCardLabel, ...(isActive ? s.optionCardLabelActive : {}) }}>{t(p.labelKey)}</div>
                <div style={s.optionCardDesc}>{t(p.descKey)}</div>
              </div>
            );
            })}
          </div>

          <label style={s.label}>{t('junior.competition_level')}</label>
          <div style={s.optionCol}>
            {LEVEL_OPTIONS.map(l => (
              <div
                key={l.id}
                style={{ ...s.optionCard, ...(level === l.id ? s.optionCardActive : {}) }}
                onClick={() => setLevel(l.id)}
              >
                <div style={{ ...s.optionCardLabel, ...(level === l.id ? s.optionCardLabelActive : {}) }}>{t(l.labelKey)}</div>
                <div style={s.optionCardDesc}>{t(l.descKey)}</div>
              </div>
            ))}
          </div>

          <label style={s.label}>{t('junior.years_playing')}</label>
          <input type="number" style={s.input} value={yearsPlaying || ''} onChange={e => setYearsPlaying(parseInt(e.target.value) || 0)} placeholder={t('junior.years_playing_placeholder')} min={0} max={18} />

          <label style={s.label}>{t('junior.practices_per_week')}</label>
          <input type="number" style={s.input} value={trainingDaysPerWeek || ''} onChange={e => setTrainingDaysPerWeek(parseInt(e.target.value) || 0)} placeholder={t('junior.practices_per_week_placeholder')} min={0} max={7} />

          <label style={s.label}>{t('junior.game_day')}</label>
          <div style={s.dayRow}>
            {DAY_OPTIONS.map(d => (
              <div
                key={d.id}
                style={{ ...s.dayBtn, ...(gameDay === d.id ? s.dayBtnActive : {}) }}
                onClick={() => setGameDay(d.id)}
              >
                {t(d.labelKey)}
              </div>
            ))}
          </div>

          <label style={s.label}>{t('junior.no_sc_days')}</label>
          <div style={s.dayRow}>
            {DAY_OPTIONS.map(d => (
              <div
                key={d.id}
                style={{ ...s.dayBtn, ...(noTrainingDays.includes(d.id) ? s.dayBtnActive : {}) }}
                onClick={() => toggleNoTrainingDay(d.id)}
              >
                {t(d.labelKey)}
              </div>
            ))}
          </div>

          <label style={s.label}>{t('junior.training_window')}</label>
          <input type="text" style={s.input} value={trainingWindow} onChange={e => setTrainingWindow(e.target.value)} placeholder={t('junior.training_window_placeholder')} />

          <label style={s.label}>{t('junior.other_sports_label')}</label>
          <div style={{ ...s.checkboxRow, ...(multiSport ? s.checkboxRowActive : {}) }} onClick={() => setMultiSport(!multiSport)}>
            <input type="checkbox" style={s.checkbox} checked={multiSport} readOnly />
            <span style={{ fontSize: 12 }}>{t('junior.other_sports_check')}</span>
          </div>
          {multiSport && (
            <input type="text" style={s.input} value={otherSports} onChange={e => setOtherSports(e.target.value)} placeholder={t('junior.other_sports_placeholder')} />
          )}

          <label style={s.label}>{t('junior.maturation_label')}</label>
          <div style={s.optionCol}>
            {MATURATION_OPTIONS.map(m => (
              <div
                key={m.id}
                style={{ ...s.optionCard, ...(maturationStage === m.id ? s.optionCardActive : {}) }}
                onClick={() => setMaturationStage(m.id)}
              >
                <div style={{ ...s.optionCardLabel, ...(maturationStage === m.id ? s.optionCardLabelActive : {}) }}>{t(m.labelKey)}</div>
                <div style={s.optionCardDesc}>{t(m.descKey)}</div>
              </div>
            ))}
          </div>

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('junior.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('junior.next')}</button>
          </div>
        </div>
      )}

      {step === 'focus_areas' && (
        <div>
          <div style={s.stepTitle}>{t('junior.focus_step')}</div>
          <p style={s.note}>{t('junior.focus_note')}</p>
          <div style={s.optionCol}>
            {FOCUS_OPTIONS.map(f => (
              <div
                key={f.value}
                style={{ ...s.checkboxRow, ...(focusAreas.includes(f.value) ? s.checkboxRowActive : {}) }}
                onClick={() => toggleFocus(f.value)}
              >
                <input type="checkbox" style={s.checkbox} checked={focusAreas.includes(f.value)} readOnly />
                <span style={{ fontSize: 12, color: focusAreas.includes(f.value) ? '#00ff41' : '#ccc' }}>{t(f.labelKey)}</span>
              </div>
            ))}
          </div>

          <label style={s.label}>{t('junior.primary_goals')}</label>
          <div style={s.optionGrid}>
            {JUNIOR_GOAL_OPTIONS.map(g => (
              <div
                key={g.id}
                style={{ ...s.optionCard, ...(primaryGoals.includes(g.id) ? s.optionCardActive : {}) }}
                onClick={() => toggleGoal(g.id)}
              >
                <div style={{ ...s.optionCardLabel, ...(primaryGoals.includes(g.id) ? s.optionCardLabelActive : {}) }}>{t(g.labelKey)}</div>
                <div style={s.optionCardDesc}>{t(g.descKey)}</div>
              </div>
            ))}
          </div>

          <label style={s.label}>{t('junior.coach_notes_label')}</label>
          <textarea style={s.textarea} value={coachNotes} onChange={e => setCoachNotes(e.target.value)} placeholder={t('junior.coach_notes_placeholder')} />

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('junior.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('junior.next')}</button>
          </div>
        </div>
      )}

      {step === 'health' && (
        <div>
          <div style={s.stepTitle}>{t('junior.health')}</div>

          <label style={s.label}>{t('junior.current_pain_label')}</label>
          <div style={{ ...s.checkboxRow, ...(hasCurrentPain ? s.checkboxRowActive : {}) }} onClick={() => setHasCurrentPain(!hasCurrentPain)}>
            <input type="checkbox" style={s.checkbox} checked={hasCurrentPain} readOnly />
            <span style={{ fontSize: 12 }}>{t('junior.current_pain_check')}</span>
          </div>
          {hasCurrentPain && (
            <>
              <textarea style={s.textarea} value={painDescription} onChange={e => setPainDescription(e.target.value)} placeholder={t('junior.pain_placeholder')} />
              <p style={s.note}>
                {t('junior.pain_note')}
              </p>
            </>
          )}

          <label style={s.label}>{t('junior.pediatrician_label')}</label>
          <div style={{ ...s.checkboxRow, ...(pediatricianClearance ? s.checkboxRowActive : {}) }} onClick={() => setPediatricianClearance(!pediatricianClearance)}>
            <input type="checkbox" style={s.checkbox} checked={pediatricianClearance} readOnly />
            <span style={{ fontSize: 12 }}>{t('junior.pediatrician_check')}</span>
          </div>
          {pediatricianClearance && (
            <>
              <label style={s.label}>{t('junior.clearance_date_label')}</label>
              <input type="date" style={s.input} value={pediatricianClearanceDate} onChange={e => setPediatricianClearanceDate(e.target.value)} />
            </>
          )}

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('junior.back')}</button>
            <button style={s.btnPrimary} onClick={nextStep}>{t('junior.next')}</button>
          </div>
        </div>
      )}

      {step === 'consent' && (
        <div>
          <div style={s.stepTitle}>{t('junior.consent_step')}</div>
          <p style={s.note}>
            {t('junior.consent_intro')}
          </p>

          <div style={s.consentBlock}>
            <div style={s.consentText}>
              {t('junior.consent_participation_text')}
            </div>
            <div style={{ ...s.checkboxRow, ...(participationConsent ? s.checkboxRowActive : {}) }} onClick={() => setParticipationConsent(!participationConsent)}>
              <input type="checkbox" style={s.checkbox} checked={participationConsent} readOnly />
              <span style={{ fontSize: 12 }}>{t('junior.consent_participation_check')}</span>
            </div>
          </div>

          <div style={s.consentBlock}>
            <div style={s.consentText}>
              {t('junior.consent_data_text')}
            </div>
            <div style={{ ...s.checkboxRow, ...(dataConsent ? s.checkboxRowActive : {}) }} onClick={() => setDataConsent(!dataConsent)}>
              <input type="checkbox" style={s.checkbox} checked={dataConsent} readOnly />
              <span style={{ fontSize: 12 }}>{t('junior.consent_data_check')}</span>
            </div>
          </div>

          <label style={s.label}>{t('junior.emergency_name_label')}</label>
          <input type="text" style={s.input} value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder={t('junior.emergency_name_placeholder')} />

          <label style={s.label}>{t('junior.relationship_label')}</label>
          <input type="text" style={s.input} value={emergencyRelationship} onChange={e => setEmergencyRelationship(e.target.value)} placeholder={t('junior.relationship_placeholder')} />

          <label style={s.label}>{t('junior.phone_label')}</label>
          <input type="tel" style={s.input} value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder={t('junior.phone_placeholder')} />

          <p style={s.note}>
            {t('junior.consent_signature_note')}
          </p>

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('junior.back')}</button>
            <button
              style={consentReady ? s.btnPrimary : s.btnPrimaryDisabled}
              disabled={!consentReady}
              onClick={() => consentReady && nextStep()}
            >
              {t('junior.review')}
            </button>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div>
          <div style={s.stepTitle}>{t('junior.review_step')}</div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('junior.review_operator')}</div>
            <div style={s.reviewValue}>{operator.callsign} {t('junior.review_age_suffix')} {age}</div>
          </div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('junior.review_sport_profile')}</div>
            <div style={s.reviewValue}>
              {(() => {
                const sportLabel = SPORT_OPTIONS.find(sp => sp.id === sport);
                const posLabel = sport === 'football'
                  ? FOOTBALL_POSITION_OPTIONS.find(p => p.id === footballPosition)
                  : POSITION_OPTIONS.find(p => p.id === position);
                const lvlLabel = LEVEL_OPTIONS.find(l => l.id === level);
                return `${sportLabel ? t(sportLabel.labelKey) + ' · ' : ''}${posLabel ? t(posLabel.labelKey) : ''} · ${lvlLabel ? t(lvlLabel.labelKey) : ''} · ${yearsPlaying} ${t('junior.review_yrs_suffix')}`;
              })()}
            </div>
            <div style={{ ...s.reviewValue, fontSize: 12, color: '#888' }}>
              {t('junior.review_game_day')} {(() => { const d = DAY_OPTIONS.find(d => d.id === gameDay); return d ? t(d.labelKey) : gameDay.toUpperCase(); })()} · {t('junior.review_sc_off')} {noTrainingDays.length ? noTrainingDays.map(id => { const d = DAY_OPTIONS.find(d => d.id === id); return d ? t(d.labelKey) : id.toUpperCase(); }).join(', ') : t('junior.review_none')}
            </div>
            {multiSport && (
              <div style={{ ...s.reviewValue, fontSize: 12, color: '#888' }}>
                {t('junior.review_also')} {otherSports || t('junior.review_multisport_unspec')}
              </div>
            )}
          </div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('junior.review_maturation')}</div>
            <div style={s.reviewValue}>{(() => { const m = MATURATION_OPTIONS.find(m => m.id === maturationStage); return m ? t(m.labelKey) : ''; })()}</div>
          </div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('junior.review_focus_areas')}</div>
            <div style={s.reviewValue}>{focusAreas.length ? focusAreas.map(v => { const f = FOCUS_OPTIONS.find(f => f.value === v); return f ? t(f.labelKey) : v; }).join(' · ') : t('junior.review_focus_default')}</div>
          </div>

          {primaryGoals.length > 0 && (
            <div style={s.reviewSection}>
              <div style={s.reviewLabel}>{t('junior.review_goals')}</div>
              <div style={s.reviewValue}>
                {primaryGoals
                  .map(id => { const g = JUNIOR_GOAL_OPTIONS.find(g => g.id === id); return g ? t(g.labelKey) : null; })
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          )}

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('junior.review_health')}</div>
            <div style={s.reviewValue}>
              {hasCurrentPain ? `${t('junior.review_pain_prefix')} ${painDescription || t('junior.review_pain_unspec')}` : t('junior.review_no_pain')}
            </div>
            <div style={{ ...s.reviewValue, fontSize: 12, color: pediatricianClearance ? '#00ff41' : '#888' }}>
              {t('junior.review_pediatrician_label')} {pediatricianClearance ? `${t('junior.review_pediatrician_yes')}${pediatricianClearanceDate ? ` (${pediatricianClearanceDate})` : ''}` : t('junior.review_pediatrician_none')}
            </div>
          </div>

          <div style={s.reviewSection}>
            <div style={s.reviewLabel}>{t('junior.review_consent')}</div>
            <div style={s.reviewValue}>{t('junior.review_participation')} {participationConsent ? '✓' : '✗'} · {t('junior.review_data')} {dataConsent ? '✓' : '✗'}</div>
            <div style={{ ...s.reviewValue, fontSize: 12, color: '#888' }}>
              {t('junior.review_emergency')} {emergencyName} {emergencyRelationship && `(${emergencyRelationship})`} — {emergencyPhone}
            </div>
          </div>

          <div style={s.navRow}>
            <button style={s.btnSecondary} onClick={prevStep}>{t('junior.back')}</button>
            <button style={s.btnPrimary} onClick={handleComplete}>{t('junior.submit')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
