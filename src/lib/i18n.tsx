'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export const translations = {
  en: {
    // Navigation/Tabs
    'nav.coc': 'COMMAND CENTER',
    'nav.coc_short': 'COC',
    'nav.planner': 'PLANNER',
    'nav.intel': 'INTEL CENTER',
    'nav.intel_short': 'INTEL',
    'nav.gunny': 'GUNNY CHAT',
    'nav.gunny_short': 'GUNNY',
    'nav.parent_hub': 'PARENT HUB',
    'nav.parent_hub_short': 'PARENT',

    // Login Screen
    'login.enter_pin': 'ENTER ACCESS CODE',
    'login.initializing': 'INITIALIZING SYSTEMS...',
    'login.access_granted': 'ACCESS GRANTED',
    'login.access_denied': 'ACCESS DENIED',

    // Dashboard (COC)
    'dashboard.weekly_ops': 'WEEKLY OPS',
    'dashboard.workouts': 'WORKOUTS',
    'dashboard.pr_records': 'PR RECORDS',
    'dashboard.readiness': 'READINESS',
    'dashboard.streak': 'STREAK',
    'dashboard.completed': 'Completed',
    'dashboard.today': 'Today',

    // Planner
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

    // Intel Center
    'intel.profile': 'PROFILE',
    'intel.nutrition': 'NUTRITION',
    'intel.pr_board': 'PR BOARD',
    'intel.injuries': 'INJURIES',
    'intel.preferences': 'PREFERENCES',
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

    // Gunny Chat
    'gunny.build_wod': 'BUILD WOD',
    'gunny.goal_paths': 'GOAL PATHS',
    'gunny.check_readiness': 'CHECK READINESS',
    'gunny.weekly_plan': 'WEEKLY PLAN',
    'gunny.macro_check': 'MACRO CHECK',
    'gunny.online': 'ONLINE',

    // Common
    'common.language': 'Language',
  },

  es: {
    // Navigation/Tabs
    'nav.coc': 'CENTRO DE COMANDO',
    'nav.coc_short': 'COC',
    'nav.planner': 'PLANIFICADOR',
    'nav.intel': 'CENTRO DE INTEL',
    'nav.intel_short': 'INTEL',
    'nav.gunny': 'CHAT GUNNY',
    'nav.gunny_short': 'GUNNY',
    'nav.parent_hub': 'CENTRO DE PADRES',
    'nav.parent_hub_short': 'PADRES',

    // Login Screen
    'login.enter_pin': 'INGRESA PIN DE ACCESO',
    'login.initializing': 'INICIALIZANDO SISTEMAS...',
    'login.access_granted': 'ACCESO CONCEDIDO',
    'login.access_denied': 'ACCESO DENEGADO',

    // Dashboard (COC)
    'dashboard.weekly_ops': 'OPS SEMANALES',
    'dashboard.workouts': 'ENTRENAMIENTOS',
    'dashboard.pr_records': 'RÉCORDS PERSONALES',
    'dashboard.readiness': 'PREPARACIÓN',
    'dashboard.streak': 'RACHA',
    'dashboard.completed': 'Completado',
    'dashboard.today': 'Hoy',

    // Planner
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

    // Intel Center
    'intel.profile': 'PERFIL',
    'intel.nutrition': 'NUTRICIÓN',
    'intel.pr_board': 'RÉCORDS',
    'intel.injuries': 'LESIONES',
    'intel.preferences': 'PREFERENCIAS',
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

    // Gunny Chat
    'gunny.build_wod': 'CREAR WOD',
    'gunny.goal_paths': 'RUTAS DE META',
    'gunny.check_readiness': 'VERIFICAR PREPARACIÓN',
    'gunny.weekly_plan': 'PLAN SEMANAL',
    'gunny.macro_check': 'VERIFICAR MACROS',
    'gunny.online': 'EN LÍNEA',

    // Common
    'common.language': 'Idioma',
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

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<'en' | 'es'>('en');

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
