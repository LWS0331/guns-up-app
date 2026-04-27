'use client';

// i18n — bilingual (EN / ES) string table + language context.
//
// Persistence: language preference is saved to localStorage under
// `gunsup-language` and restored on mount. Without persistence the
// previous implementation reverted to English on every reload, which
// made the bilingual feature claim effectively non-functional for
// returning Spanish-speaking operators.
//
// Adding new strings:
//   1. Add the key + EN value in the `en` block
//   2. Add the same key + ES translation in the `es` block
//   3. Use `const { t } = useLanguage()` and `t('your.key')` in JSX
//   4. If a key is missing in one block the helper falls back to the
//      key itself (visible in dev as `your.key`) — easy to spot.

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export const translations = {
  en: {
    // ─── Navigation / Tabs ──────────────────────────────────────────
    'nav.coc': 'COMMAND CENTER',
    'nav.coc_short': 'COC',
    'nav.planner': 'PLANNER',
    'nav.intel': 'INTEL CENTER',
    'nav.intel_short': 'INTEL',
    'nav.gunny': 'GUNNY CHAT',
    'nav.gunny_short': 'GUNNY',
    'nav.parent_hub': 'PARENT HUB',
    'nav.parent_hub_short': 'PARENT',
    'nav.ops': 'OPS',

    // ─── Login Screen ───────────────────────────────────────────────
    'login.enter_pin': 'ENTER ACCESS CODE',
    'login.initializing': 'INITIALIZING SYSTEMS...',
    'login.access_granted': 'ACCESS GRANTED',
    'login.access_denied': 'ACCESS DENIED',
    'login.member_login': 'MEMBER LOGIN',
    'login.create_account': 'CREATE ACCOUNT',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.callsign': 'Callsign',
    'login.signup': 'SIGN UP',
    'login.login': 'LOG IN',
    'login.have_account': 'Already have an account? LOG IN',
    'login.no_account': 'No account? SIGN UP',

    // ─── Dashboard (COC) ────────────────────────────────────────────
    'dashboard.weekly_ops': 'WEEKLY OPS',
    'dashboard.workouts': 'WORKOUTS',
    'dashboard.pr_records': 'PR RECORDS',
    'dashboard.readiness': 'READINESS',
    'dashboard.streak': 'STREAK',
    'dashboard.completed': 'Completed',
    'dashboard.today': 'Today',
    'dashboard.this_week': 'This Week',
    'dashboard.this_month': 'This Month',
    'dashboard.daily_brief': 'DAILY BRIEF',
    'dashboard.battle_plan': 'BATTLE PLAN',

    // ─── Planner ────────────────────────────────────────────────────
    'planner.title': 'WORKOUT BUILDER',
    'planner.title_label': 'Title',
    'planner.notes': 'Notes',
    'planner.warmup': 'Warmup',
    'planner.cooldown': 'Cooldown',
    'planner.add_exercise': 'Add Exercise',
    'planner.add_conditioning': 'Add Conditioning',
    'planner.save': 'Save Workout',
    'planner.cancel': 'Cancel',
    'planner.exercise_name': 'Exercise Name',
    'planner.prescription': 'Prescription',
    'planner.delete': 'Delete',
    'planner.copy': 'COPY',
    'planner.paste': 'PASTE',
    'planner.month_view': 'MONTH',
    'planner.week_view': 'WEEK',
    'planner.day_view': 'DAY',
    'planner.start_workout': 'START WORKOUT',
    'planner.complete_workout': 'COMPLETE WORKOUT',
    'planner.log_set': 'LOG SET',
    'planner.next_set': 'NEXT SET',
    'planner.remove_this': 'REMOVE THIS',
    'planner.all_sets_complete': 'ALL SETS COMPLETE',
    'planner.now_set': 'NOW · SET',
    'planner.weight': 'WEIGHT',
    'planner.reps': 'REPS',
    'planner.rpe': 'RPE',
    'planner.rest': 'REST',
    'planner.rest_target': '// Rest · Tgt',
    'planner.set_log': '// Set · Log',
    'planner.vitals_live': '// Vitals · Live',
    'planner.pause': 'PAUSE',
    'planner.reset': 'RESET',
    'planner.add_30s': '+30S',
    'planner.no_workout_today': 'No workout scheduled today',
    'planner.build_workout': 'BUILD WORKOUT',
    'planner.go_time': 'GO TIME',
    'planner.format': 'Format',
    'planner.score': 'Score',
    'planner.complete': 'Complete',
    'planner.done': 'Done',

    // ─── Intel Center ───────────────────────────────────────────────
    'intel.profile': 'PROFILE',
    'intel.nutrition': 'NUTRITION',
    'intel.pr_board': 'PR BOARD',
    'intel.analytics': 'ANALYTICS',
    'intel.injuries': 'INJURIES',
    'intel.preferences': 'PREFERENCES',
    'intel.wearables': 'WEARABLES',
    'intel.name': 'Name',
    'intel.age': 'Age',
    'intel.height': 'Height',
    'intel.weight': 'Weight',
    'intel.body_fat': 'Body Fat',
    'intel.training_age': 'Training Age',
    'intel.goals': 'Goals',
    'intel.readiness': 'Readiness',
    'intel.sleep': 'Sleep',
    'intel.stress': 'Stress',
    'intel.pin': 'Access PIN',
    'intel.callsign': 'Callsign',
    'intel.calories': 'Calories',
    'intel.protein': 'Protein',
    'intel.carbs': 'Carbs',
    'intel.fat': 'Fat',
    'intel.add_meal': 'Add Meal',
    'intel.meal_name': 'Meal Name',
    'intel.save_changes': 'Save Changes',
    'intel.training_split': 'Training Split',
    'intel.equipment': 'Equipment',
    'intel.session_duration': 'Session Duration',
    'intel.days_per_week': 'Days Per Week',
    'intel.weak_points': 'Weak Points',
    'intel.movements_avoid': 'Movements to Avoid',
    'intel.macro_targets': 'MACRO TARGETS',
    'intel.log_meal': 'LOG MEAL',
    'intel.todays_total': "TODAY'S TOTAL",
    'intel.add_pr': 'Add PR',
    'intel.exercise': 'Exercise',
    'intel.date': 'Date',
    'intel.injury_name': 'Injury',
    'intel.status': 'Status',
    'intel.active': 'Active',
    'intel.recovering': 'Recovering',
    'intel.cleared': 'Cleared',
    'intel.restrictions': 'Restrictions',

    // ─── Subscription / Billing ─────────────────────────────────────
    'billing.subscription': 'SUBSCRIPTION',
    'billing.beta_active': 'Beta access active. Lock in a tier to keep going past the trial — no interruption to your data, plans, or PRs.',
    'billing.monthly': 'MONTHLY',
    'billing.annual': 'ANNUAL',
    'billing.choose': 'CHOOSE',
    'billing.confirm': 'CONFIRM THIS TIER',
    'billing.current_tier': 'CURRENT TIER',
    'billing.manage_billing': 'Manage Billing',
    'billing.save': 'save',
    'billing.month': 'mo',
    'billing.year': 'yr',

    // ─── Gunny Chat ─────────────────────────────────────────────────
    'gunny.build_wod': 'BUILD WOD',
    'gunny.trainer_wod': 'TRAINER WOD',
    'gunny.goal_paths': 'GOAL PATHS',
    'gunny.check_readiness': 'CHECK READINESS',
    'gunny.weekly_plan': 'WEEKLY PLAN',
    'gunny.macro_check': 'MACRO CHECK',
    'gunny.cool_down': 'COOL DOWN',
    'gunny.my_clients': 'MY CLIENTS',
    'gunny.online': 'ONLINE',
    'gunny.offline': 'OFFLINE',
    'gunny.opus': 'OPUS',
    'gunny.placeholder': "What's the mission, champ?",
    'gunny.send': 'SEND',
    'gunny.welcome': 'War room is open',
    'gunny.thinking': 'Thinking...',
    'gunny.tap_to_speak': 'TAP TO SPEAK',
    'gunny.recording': 'RECORDING',
    'gunny.need_help': 'NEED HELP? ASK GUNNY',

    // ─── Tier upgrade card ──────────────────────────────────────────
    'upgrade.locked': 'LOCKED',
    'upgrade.tier_required': 'tier required',
    'upgrade.unlock_with': 'Unlock with',
    'upgrade.view_pricing': 'View Pricing',

    // ─── Common ─────────────────────────────────────────────────────
    'common.language': 'Language',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.next': 'Next',
    'common.back': 'Back',
    'common.submit': 'Submit',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.retry': 'Retry',
    'common.skip': 'Skip',
    'common.continue': 'Continue',
    'common.confirm': 'Confirm',
    'common.required': 'required',
    'common.optional': 'optional',
  },

  es: {
    // ─── Navigation / Tabs ──────────────────────────────────────────
    'nav.coc': 'CENTRO DE COMANDO',
    'nav.coc_short': 'COC',
    'nav.planner': 'PLANIFICADOR',
    'nav.intel': 'CENTRO DE INTEL',
    'nav.intel_short': 'INTEL',
    'nav.gunny': 'CHAT GUNNY',
    'nav.gunny_short': 'GUNNY',
    'nav.parent_hub': 'CENTRO DE PADRES',
    'nav.parent_hub_short': 'PADRES',
    'nav.ops': 'OPS',

    // ─── Login Screen ───────────────────────────────────────────────
    'login.enter_pin': 'INGRESA PIN DE ACCESO',
    'login.initializing': 'INICIALIZANDO SISTEMAS...',
    'login.access_granted': 'ACCESO CONCEDIDO',
    'login.access_denied': 'ACCESO DENEGADO',
    'login.member_login': 'INICIO DE SESIÓN',
    'login.create_account': 'CREAR CUENTA',
    'login.email': 'Correo',
    'login.password': 'Contraseña',
    'login.callsign': 'Indicativo',
    'login.signup': 'REGISTRARSE',
    'login.login': 'INICIAR SESIÓN',
    'login.have_account': '¿Ya tienes cuenta? INICIA SESIÓN',
    'login.no_account': '¿Sin cuenta? REGÍSTRATE',

    // ─── Dashboard (COC) ────────────────────────────────────────────
    'dashboard.weekly_ops': 'OPS SEMANALES',
    'dashboard.workouts': 'ENTRENAMIENTOS',
    'dashboard.pr_records': 'RÉCORDS PERSONALES',
    'dashboard.readiness': 'PREPARACIÓN',
    'dashboard.streak': 'RACHA',
    'dashboard.completed': 'Completado',
    'dashboard.today': 'Hoy',
    'dashboard.this_week': 'Esta Semana',
    'dashboard.this_month': 'Este Mes',
    'dashboard.daily_brief': 'PARTE DIARIO',
    'dashboard.battle_plan': 'PLAN DE BATALLA',

    // ─── Planner ────────────────────────────────────────────────────
    'planner.title': 'CONSTRUCTOR DE ENTRENAMIENTO',
    'planner.title_label': 'Título',
    'planner.notes': 'Notas',
    'planner.warmup': 'Calentamiento',
    'planner.cooldown': 'Enfriamiento',
    'planner.add_exercise': 'Agregar Ejercicio',
    'planner.add_conditioning': 'Agregar Acondicionamiento',
    'planner.save': 'Guardar Entrenamiento',
    'planner.cancel': 'Cancelar',
    'planner.exercise_name': 'Nombre del Ejercicio',
    'planner.prescription': 'Prescripción',
    'planner.delete': 'Eliminar',
    'planner.copy': 'COPIAR',
    'planner.paste': 'PEGAR',
    'planner.month_view': 'MES',
    'planner.week_view': 'SEMANA',
    'planner.day_view': 'DÍA',
    'planner.start_workout': 'INICIAR ENTRENAMIENTO',
    'planner.complete_workout': 'COMPLETAR ENTRENAMIENTO',
    'planner.log_set': 'REGISTRAR SERIE',
    'planner.next_set': 'SIGUIENTE SERIE',
    'planner.remove_this': 'QUITAR ESTE',
    'planner.all_sets_complete': 'TODAS LAS SERIES COMPLETAS',
    'planner.now_set': 'AHORA · SERIE',
    'planner.weight': 'PESO',
    'planner.reps': 'REPS',
    'planner.rpe': 'RPE',
    'planner.rest': 'DESCANSO',
    'planner.rest_target': '// Descanso · Obj',
    'planner.set_log': '// Serie · Reg',
    'planner.vitals_live': '// Vitales · En vivo',
    'planner.pause': 'PAUSA',
    'planner.reset': 'REINICIAR',
    'planner.add_30s': '+30S',
    'planner.no_workout_today': 'Sin entrenamiento programado hoy',
    'planner.build_workout': 'CREAR ENTRENAMIENTO',
    'planner.go_time': 'A POR ELLO',
    'planner.format': 'Formato',
    'planner.score': 'Puntuación',
    'planner.complete': 'Completar',
    'planner.done': 'Listo',

    // ─── Intel Center ───────────────────────────────────────────────
    'intel.profile': 'PERFIL',
    'intel.nutrition': 'NUTRICIÓN',
    'intel.pr_board': 'RÉCORDS',
    'intel.analytics': 'ANÁLISIS',
    'intel.injuries': 'LESIONES',
    'intel.preferences': 'PREFERENCIAS',
    'intel.wearables': 'WEARABLES',
    'intel.name': 'Nombre',
    'intel.age': 'Edad',
    'intel.height': 'Altura',
    'intel.weight': 'Peso',
    'intel.body_fat': 'Grasa Corporal',
    'intel.training_age': 'Años Entrenando',
    'intel.goals': 'Objetivos',
    'intel.readiness': 'Preparación',
    'intel.sleep': 'Sueño',
    'intel.stress': 'Estrés',
    'intel.pin': 'PIN de Acceso',
    'intel.callsign': 'Indicativo',
    'intel.calories': 'Calorías',
    'intel.protein': 'Proteína',
    'intel.carbs': 'Carbohidratos',
    'intel.fat': 'Grasa',
    'intel.add_meal': 'Agregar Comida',
    'intel.meal_name': 'Nombre de Comida',
    'intel.save_changes': 'Guardar Cambios',
    'intel.training_split': 'División de Entrenamiento',
    'intel.equipment': 'Equipamiento',
    'intel.session_duration': 'Duración de Sesión',
    'intel.days_per_week': 'Días Por Semana',
    'intel.weak_points': 'Puntos Débiles',
    'intel.movements_avoid': 'Movimientos a Evitar',
    'intel.macro_targets': 'OBJETIVOS DE MACROS',
    'intel.log_meal': 'REGISTRAR COMIDA',
    'intel.todays_total': 'TOTAL DE HOY',
    'intel.add_pr': 'Agregar Récord',
    'intel.exercise': 'Ejercicio',
    'intel.date': 'Fecha',
    'intel.injury_name': 'Lesión',
    'intel.status': 'Estado',
    'intel.active': 'Activa',
    'intel.recovering': 'En Recuperación',
    'intel.cleared': 'Recuperado',
    'intel.restrictions': 'Restricciones',

    // ─── Subscription / Billing ─────────────────────────────────────
    'billing.subscription': 'SUSCRIPCIÓN',
    'billing.beta_active': 'Acceso beta activo. Bloquea un nivel para continuar después del periodo de prueba — sin interrupciones a tus datos, planes o récords.',
    'billing.monthly': 'MENSUAL',
    'billing.annual': 'ANUAL',
    'billing.choose': 'ELEGIR',
    'billing.confirm': 'CONFIRMAR ESTE NIVEL',
    'billing.current_tier': 'NIVEL ACTUAL',
    'billing.manage_billing': 'Administrar Facturación',
    'billing.save': 'ahorra',
    'billing.month': 'mes',
    'billing.year': 'año',

    // ─── Gunny Chat ─────────────────────────────────────────────────
    'gunny.build_wod': 'CREAR WOD',
    'gunny.trainer_wod': 'WOD ENTRENADOR',
    'gunny.goal_paths': 'RUTAS DE META',
    'gunny.check_readiness': 'VERIFICAR PREPARACIÓN',
    'gunny.weekly_plan': 'PLAN SEMANAL',
    'gunny.macro_check': 'VERIFICAR MACROS',
    'gunny.cool_down': 'ENFRIAMIENTO',
    'gunny.my_clients': 'MIS CLIENTES',
    'gunny.online': 'EN LÍNEA',
    'gunny.offline': 'DESCONECTADO',
    'gunny.opus': 'OPUS',
    'gunny.placeholder': '¿Cuál es la misión, campeón?',
    'gunny.send': 'ENVIAR',
    'gunny.welcome': 'La sala de guerra está abierta',
    'gunny.thinking': 'Pensando...',
    'gunny.tap_to_speak': 'TOCA PARA HABLAR',
    'gunny.recording': 'GRABANDO',
    'gunny.need_help': '¿NECESITAS AYUDA? PREGÚNTALE A GUNNY',

    // ─── Tier upgrade card ──────────────────────────────────────────
    'upgrade.locked': 'BLOQUEADO',
    'upgrade.tier_required': 'nivel requerido',
    'upgrade.unlock_with': 'Desbloquea con',
    'upgrade.view_pricing': 'Ver Precios',

    // ─── Common ─────────────────────────────────────────────────────
    'common.language': 'Idioma',
    'common.yes': 'Sí',
    'common.no': 'No',
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.close': 'Cerrar',
    'common.next': 'Siguiente',
    'common.back': 'Atrás',
    'common.submit': 'Enviar',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.retry': 'Reintentar',
    'common.skip': 'Omitir',
    'common.continue': 'Continuar',
    'common.confirm': 'Confirmar',
    'common.required': 'requerido',
    'common.optional': 'opcional',
  },
};

interface LanguageContextType {
  language: 'en' | 'es';
  setLanguage: (lang: 'en' | 'es') => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'gunsup-language';

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  // Initialize from localStorage if available, otherwise EN. We can't read
  // localStorage during SSR, so first render is always EN; the useEffect
  // below corrects it on the client. To avoid a brief flash, the language
  // toggle persists immediately and reads stay synchronous after mount.
  const [language, setLanguageState] = useState<'en' | 'es'>('en');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'es' || saved === 'en') {
        setLanguageState(saved);
      } else {
        // First-time visitor: try to honor browser preference. ES locales
        // get Spanish by default; everything else stays English.
        const navLang = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
        if (navLang.startsWith('es')) {
          setLanguageState('es');
          localStorage.setItem(STORAGE_KEY, 'es');
        }
      }
    } catch { /* localStorage unavailable */ }
  }, []);

  const setLanguage = (lang: 'en' | 'es') => {
    setLanguageState(lang);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
        // Also reflect on <html lang> for accessibility + browser hints
        document.documentElement.lang = lang;
      }
    } catch { /* localStorage unavailable */ }
  };

  // Keep <html lang> in sync on every change
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = (key: string): string => {
    const trans = translations[language] as Record<string, string>;
    return trans[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
