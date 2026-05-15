'use client';

// OperatingManual — user-facing feature documentation rendered inside
// IntelCenter as the "MANUAL" sub-tab.
//
// Parallels OpsRoadmap.tsx (founder-only strategic ops brief) but for
// operators: every major feature, where it lives in the app, how to
// use it, and the common pitfalls. The whole document is hard-coded
// content; revise the SECTIONS_EN / SECTIONS_ES arrays when shipping
// new features so this stays in sync with reality.
//
// Bilingual: language preference is read from useLanguage(); the
// matching content array renders. Keeping the EN / ES copy together
// in one file (rather than blowing up i18n.tsx with hundreds of lines
// of long-form prose) makes the manual easier to keep coherent — when
// you edit one section you see both languages in the same diff.

import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';

// ─── Content shapes ─────────────────────────────────────────────────

interface ManualStep {
  /** One-line action heading, e.g. "Tap PLANNER on the bottom nav" */
  heading: string;
  /** Optional follow-up details. Plain text, no markdown. */
  detail?: string;
}

interface ManualTip {
  kind: 'tip' | 'warning' | 'pro';
  text: string;
}

interface ManualSection {
  /** Two-digit section number, e.g. "01". Used in the eyebrow. */
  num: string;
  /** Section title, e.g. "Command Center". */
  title: string;
  /** Where to find it. One short sentence — e.g. "Bottom nav → COC". */
  whereToFind: string;
  /** What this feature does. 2–3 sentences. */
  what: string;
  /** Step-by-step usage. Walk an operator through it linearly. */
  howTo: ManualStep[];
  /** Optional tips, warnings, and pro-moves. */
  tips?: ManualTip[];
}

// ─── EN content ─────────────────────────────────────────────────────

const SECTIONS_EN: ManualSection[] = [
  {
    num: '01',
    title: 'Command Center (COC)',
    whereToFind: 'Bottom nav → COC.',
    what:
      'Your daily dashboard. Surfaces today\'s workout, current readiness score, weekly streak, PR records, and the daily brief Gunny generated for you overnight. This is the screen you should land on every morning.',
    howTo: [
      { heading: 'Open the app — you start on COC by default.' },
      { heading: 'Read the Daily Brief panel at the top.', detail: 'Gunny rebuilds it every night based on your last 7 days. Mood / sleep / readiness all factor in.' },
      { heading: 'Check today\'s workout card.', detail: 'Tap to jump into the Planner with today\'s plan loaded.' },
      { heading: 'Glance at the streak + readiness gauges.', detail: 'A red readiness score means take it lighter today — don\'t fight the data.' },
    ],
    tips: [
      { kind: 'tip', text: 'If COC looks empty, your SITREP probably hasn\'t been generated yet — finish your intake.' },
      { kind: 'pro', text: 'Pull down to refresh — pulls the latest from the server.' },
    ],
  },
  {
    num: '02',
    title: 'Planner & Workout Mode',
    whereToFind: 'Bottom nav → PLANNER.',
    what:
      'Your training calendar plus the live workout-mode you tap into during a session. Calendar views (month / week / day) show every workout your coach assigned. Workout Mode is where you log sets in real time with weight, reps, RPE, and rest timers.',
    howTo: [
      { heading: 'Open Planner.', detail: 'Default view is the month grid.' },
      { heading: 'Tap any day to see that day\'s workout.' },
      { heading: 'On today\'s workout, tap START WORKOUT.', detail: 'You enter Workout Mode — the timer starts and the first set is queued up.' },
      { heading: 'Log each set: weight, reps, RPE.', detail: 'RPE = Rate of Perceived Exertion, 1–10. 10 = maxed out.' },
      { heading: 'Tap LOG SET → NEXT SET.', detail: 'Rest timer auto-starts. Add 30 seconds with the +30S button if you need it.' },
      { heading: 'When done, mark your SESSION RPE.', detail: 'How hard was the whole session? This drives autoregulation — your next workout adjusts based on it.' },
    ],
    tips: [
      { kind: 'tip', text: 'You can copy a day to another day with the COPY / PASTE buttons in week view — useful for repeating a template.' },
      { kind: 'warning', text: 'Don\'t skip the SESSION RPE. It\'s how Gunny knows whether to push you harder or back off next session.' },
      { kind: 'pro', text: 'Long-press an exercise to ask Gunny mid-set: "modify this", "form check", "I can\'t do this — swap it".' },
    ],
  },
  {
    num: '03',
    title: 'Your AI Coach (Gunny / Raven / Buck / Coach)',
    whereToFind: 'Bottom nav → GUNNY (or your selected coach).',
    what:
      'Your 24/7 AI coach. Picked once during onboarding (you can change later). Each persona has a different voice — Gunny is the standard Marine DI; Raven is laconic and surgical; Buck explains the why; Coach is youth-only (10–18). Same training science, different delivery.',
    howTo: [
      { heading: 'Open the chat tab.', detail: 'It opens with a fresh greeting from your coach — they remember your last session, current SITREP, and recent workouts.' },
      { heading: 'Type a question, or tap one of the action chips.', detail: 'Common chips: BUILD A WORKOUT, FORM CHECK, ADJUST TODAY\'S WORKOUT, MEAL CHECK.' },
      { heading: 'Send a photo for form review.', detail: 'Tap the camera icon. Photo of your bench setup → coach reads it and gives concrete fixes.' },
      { heading: 'Send a meal photo for macros.', detail: 'Snap your plate. Coach returns estimated calories, protein, carbs, fat — auto-logged to today.' },
      { heading: 'Ask for a workout modification.', detail: '"My shoulder is tweaked, swap pressing for today" — coach rewrites the day with valid alternatives.' },
    ],
    tips: [
      { kind: 'tip', text: 'Voice is on by default — toggle it from the mic icon in the chat header.' },
      { kind: 'pro', text: 'You can switch coaches from Intel Center → Preferences. Same data follows you, just a different voice.' },
      { kind: 'warning', text: 'Coach is not a doctor. Anything medical → talk to a real one.' },
    ],
  },
  {
    num: '04',
    title: 'SITREP / Battle Plan',
    whereToFind: 'COC → DAILY BRIEF banner, or Intel Center → Profile.',
    what:
      'Your full multi-week training program — split, days/week, session length, progression strategy, deload protocol, and any active goal periodization (macrocycles). Generated by Gunny after intake. Approve once and it drives every workout the Planner shows.',
    howTo: [
      { heading: 'Complete your intake.', detail: 'After signup, the app walks you through 5–10 minutes of questions about goals, equipment, injuries, schedule.' },
      { heading: 'Wait ~30–60 seconds.', detail: 'Gunny builds your SITREP. You\'ll see the loading screen.' },
      { heading: 'Review the proposed plan.', detail: 'You can ask for changes ("I want more legs days", "I don\'t have a barbell at home").' },
      { heading: 'Approve.', detail: 'Once approved, it becomes your active battle plan. Planner populates with all upcoming workouts.' },
    ],
    tips: [
      { kind: 'pro', text: 'Ask for a SITREP REGEN any time your situation changes — new injury, new gym, switching goals. It\'s cheap.' },
      { kind: 'tip', text: 'The DELOAD week is intentional. Don\'t skip it — that\'s where your gains lock in.' },
    ],
  },
  {
    num: '05',
    title: 'Daily Brief',
    whereToFind: 'COC → top panel.',
    what:
      'Your morning intel: yesterday\'s recap, today\'s mission, key macros to hit, sleep / stress signals from your wearable, and any priority adjustment from your coach. Auto-generated overnight — fresh by the time you wake up.',
    howTo: [
      { heading: 'Land on COC.', detail: 'The brief is the top card.' },
      { heading: 'Read it once before training.', detail: 'It\'s tuned to today specifically — knowing the priority before you walk in changes what you do.' },
      { heading: 'Tap any callout to drill in.', detail: 'Macros → Nutrition tab. Workout → Planner. Recovery flag → Wearables.' },
    ],
    tips: [
      { kind: 'pro', text: 'Subscribe to the morning push notification (Settings → Notifications) so the brief lands on your lock screen.' },
    ],
  },
  {
    num: '06',
    title: 'Intel Center — Profile, PRs, Nutrition',
    whereToFind: 'Bottom nav → INTEL.',
    what:
      'Your central profile. Eight sub-tabs: PROFILE (identity + body data), NUTRITION (macros + meals), PR BOARD (lifts + records), ANALYTICS (charts), INJURIES (active + history), MACROCYCLE (long-term goal periodization), PREFERENCES (training prefs + persona), WEARABLES (device hub), and MANUAL (this guide).',
    howTo: [
      { heading: 'Open INTEL.' },
      { heading: 'Tab through the sub-tabs at the top.', detail: 'On mobile they\'re a horizontal scroll strip. On desktop / iPad they spread across the top.' },
      { heading: 'In PROFILE, keep your weight and body fat current.', detail: 'These feed every macro and progression calculation downstream.' },
      { heading: 'In NUTRITION, log meals — manually, by photo, or by search.', detail: 'Daily totals roll up. Coach can read these in chat.' },
      { heading: 'In PR BOARD, log every PR.', detail: 'Drives the autoregulation engine — Gunny calculates working weights from these.' },
    ],
    tips: [
      { kind: 'warning', text: 'If you log a 1RM you can\'t actually hit, your future workouts will be too heavy. Be honest.' },
      { kind: 'pro', text: 'PHOTO ANALYSIS in Nutrition uses Claude vision — works on a plate of food, a nutrition label, or a restaurant menu.' },
    ],
  },
  {
    num: '07',
    title: 'Wearables',
    whereToFind: 'INTEL → WEARABLES.',
    what:
      'Connect your wearable (Apple Watch, Garmin, Whoop, Oura) to feed sleep, HRV, and resting HR into the readiness engine. Drives the GO_HARD / NORMAL / DELOAD / REST recommendation you see on COC.',
    howTo: [
      { heading: 'Open INTEL → WEARABLES.' },
      { heading: 'Tap CONNECT next to your device.', detail: 'You\'ll be redirected to the provider\'s OAuth flow — sign in with your existing account.' },
      { heading: 'Approve the data scopes.', detail: 'We only request sleep, HRV, RHR, and steps. We don\'t pull GPS routes, heart-rate streams, or anything else.' },
      { heading: 'Wait ~24h for the first sync.', detail: 'Then check READINESS PANEL — you\'ll see your baseline forming.' },
    ],
    tips: [
      { kind: 'tip', text: 'No wearable? You can still use the app. Manually rate sleep / stress / mood every morning to feed the same engine.' },
      { kind: 'warning', text: 'Wearables tier-gated to COMMANDER+. Intel will show an upgrade card if you\'re below.' },
    ],
  },
  {
    num: '08',
    title: 'Notifications',
    whereToFind: 'INTEL → PREFERENCES → Notifications.',
    what:
      'Configure when the app pings you. Workout reminders, meal logging nudges, hydration pings, the morning brief alert, and the evening check-in. All optional, all granular.',
    howTo: [
      { heading: 'Open INTEL → PREFERENCES.' },
      { heading: 'Scroll to Notifications.' },
      { heading: 'Toggle each category on / off.', detail: 'Set custom times for the morning brief and evening check-in.' },
      { heading: 'Approve the OS-level permission when prompted.', detail: 'Without it, the app can\'t deliver push notifications even if you toggled them on in-app.' },
    ],
    tips: [
      { kind: 'pro', text: 'The morning compliance check is the highest-leverage one — it surfaces if your daily brief is ready, what your readiness is, and if today is a rest day.' },
    ],
  },
  {
    num: '09',
    title: 'Beta Feedback',
    whereToFind: 'Settings menu (top-right gear icon) → Beta Feedback.',
    what:
      'How you tell us what\'s broken or what you wish existed. Every report goes into a queue we triage during the closed beta. Bug, recommendation, UI/UX, performance — pick a category, drop in a description, attach a screenshot.',
    howTo: [
      { heading: 'Tap the gear icon at the top of any screen.' },
      { heading: 'Select Beta Feedback.' },
      { heading: 'Pick the report type.', detail: 'BUG / RECOMMENDATION / UI/UX / PERFORMANCE.' },
      { heading: 'Pick severity.', detail: 'CRITICAL = app unusable. HIGH = major flow broken. MEDIUM = annoying. LOW = nice-to-have.' },
      { heading: 'Describe what happened or what you wish existed.', detail: 'The more specific, the faster we can act on it.' },
      { heading: 'Attach a screenshot if relevant.', detail: 'Optional but speeds triage 10x.' },
    ],
    tips: [
      { kind: 'pro', text: 'Anything you submit gets read. We tag it NEW → REVIEWING → FIXED / WONTFIX, and you can see status in the same panel.' },
    ],
  },
  {
    num: '10',
    title: 'Account & Language',
    whereToFind: 'Settings menu (gear icon).',
    what:
      'Your account essentials: email, password reset, language preference, and logout. Language is locked at signup — switching requires a support request.',
    howTo: [
      { heading: 'Tap the gear icon.' },
      { heading: 'Update your email or reset your password from the account row.' },
      { heading: 'Need to switch EN ↔ ES?', detail: 'Email support — we\'ll flip the flag on the server. The in-app toggle was retired to prevent accidental switches.' },
      { heading: 'Log out from the bottom of the menu.' },
    ],
    tips: [
      { kind: 'tip', text: 'Forgot password? Use the "Recover Access" link on the login screen — we\'ll email you a magic link.' },
    ],
  },
];

// ─── ES content ─────────────────────────────────────────────────────

const SECTIONS_ES: ManualSection[] = [
  {
    num: '01',
    title: 'Centro de Comando (COC)',
    whereToFind: 'Barra inferior → COC.',
    what:
      'Tu tablero diario. Muestra el entrenamiento de hoy, tu puntuación de preparación, racha semanal, récords personales, y el informe diario que Gunny generó durante la noche. Esta es la pantalla a la que debes llegar cada mañana.',
    howTo: [
      { heading: 'Abre la app — empiezas en COC por defecto.' },
      { heading: 'Lee el panel de Informe Diario arriba.', detail: 'Gunny lo reconstruye cada noche con base en tus últimos 7 días. Ánimo, sueño y preparación todos cuentan.' },
      { heading: 'Revisa la tarjeta de entrenamiento de hoy.', detail: 'Tócala para ir al Planificador con el plan de hoy listo.' },
      { heading: 'Mira los indicadores de racha y preparación.', detail: 'Una preparación en rojo significa que tomes hoy más suave — no pelees con los datos.' },
    ],
    tips: [
      { kind: 'tip', text: 'Si COC se ve vacío, probablemente no se ha generado tu SITREP — completa tu intake.' },
      { kind: 'pro', text: 'Desliza hacia abajo para refrescar — trae lo último del servidor.' },
    ],
  },
  {
    num: '02',
    title: 'Planificador y Modo Entrenamiento',
    whereToFind: 'Barra inferior → PLANIFICADOR.',
    what:
      'Tu calendario de entrenamiento más el modo en vivo durante una sesión. Las vistas (mes / semana / día) muestran cada entrenamiento que tu coach asignó. El Modo Entrenamiento es donde registras series en tiempo real con peso, reps, RPE y temporizadores.',
    howTo: [
      { heading: 'Abre el Planificador.', detail: 'La vista por defecto es la cuadrícula del mes.' },
      { heading: 'Toca cualquier día para ver el entrenamiento.' },
      { heading: 'En el de hoy, toca INICIAR ENTRENAMIENTO.', detail: 'Entras al Modo Entrenamiento — el cronómetro arranca y la primera serie está lista.' },
      { heading: 'Registra cada serie: peso, reps, RPE.', detail: 'RPE = Esfuerzo Percibido, 1–10. 10 = al límite.' },
      { heading: 'Toca REGISTRAR SERIE → SIGUIENTE SERIE.', detail: 'El descanso arranca solo. Suma 30 segundos con el botón +30S si lo necesitas.' },
      { heading: 'Al terminar, marca tu RPE DE SESIÓN.', detail: '¿Qué tan duro fue el total? Esto alimenta la autorregulación — tu siguiente entrenamiento se ajusta con base en esto.' },
    ],
    tips: [
      { kind: 'tip', text: 'Puedes copiar un día a otro con los botones COPIAR / PEGAR en vista semanal — útil para repetir plantillas.' },
      { kind: 'warning', text: 'No te saltes el RPE DE SESIÓN. Así Gunny sabe si empujarte más o menos en la próxima sesión.' },
      { kind: 'pro', text: 'Mantén presionado un ejercicio para preguntarle a Gunny en medio: "modifica esto", "revisa mi forma", "no puedo hacerlo — cámbialo".' },
    ],
  },
  {
    num: '03',
    title: 'Tu Coach IA (Gunny / Raven / Buck / Coach)',
    whereToFind: 'Barra inferior → GUNNY (o el coach que elegiste).',
    what:
      'Tu coach IA 24/7. Lo eliges una vez en el onboarding (puedes cambiarlo después). Cada persona tiene una voz distinta — Gunny es el sargento DI estándar; Raven es lacónica y quirúrgica; Buck te explica el porqué; Coach es solo para jóvenes (10–18). Misma ciencia, distinta entrega.',
    howTo: [
      { heading: 'Abre la pestaña de chat.', detail: 'Te recibe un saludo fresco — el coach recuerda tu última sesión, SITREP actual, y entrenamientos recientes.' },
      { heading: 'Escribe una pregunta o toca un chip de acción.', detail: 'Chips comunes: CREA UN ENTRENAMIENTO, REVISA MI FORMA, AJUSTA EL DE HOY, REVISA MI COMIDA.' },
      { heading: 'Envía una foto para revisar tu forma.', detail: 'Toca el icono de cámara. Foto de tu sentadilla → el coach la lee y te da arreglos concretos.' },
      { heading: 'Envía una foto de comida para macros.', detail: 'Toma tu plato. El coach devuelve calorías, proteína, carbos, grasa estimadas — registrado automáticamente.' },
      { heading: 'Pide una modificación.', detail: '"Me duele el hombro, cambia el press hoy" — el coach reescribe el día con alternativas válidas.' },
    ],
    tips: [
      { kind: 'tip', text: 'La voz está activa por defecto — apágala con el icono de micrófono arriba del chat.' },
      { kind: 'pro', text: 'Puedes cambiar de coach desde Intel → Preferencias. Tus datos te siguen, solo cambia la voz.' },
      { kind: 'warning', text: 'El coach no es médico. Cualquier tema médico → consulta a uno real.' },
    ],
  },
  {
    num: '04',
    title: 'SITREP / Plan de Batalla',
    whereToFind: 'COC → banner DAILY BRIEF, o Intel → Perfil.',
    what:
      'Tu programa de entrenamiento completo de varias semanas — split, días/semana, duración por sesión, estrategia de progresión, protocolo de descarga, y cualquier periodización activa (macrociclos). Gunny lo genera después del intake. Apruébalo una vez y rige cada entrenamiento del Planificador.',
    howTo: [
      { heading: 'Completa tu intake.', detail: 'Después de registrarte, la app te hace 5–10 minutos de preguntas sobre objetivos, equipo, lesiones, horario.' },
      { heading: 'Espera ~30–60 segundos.', detail: 'Gunny construye tu SITREP. Verás la pantalla de carga.' },
      { heading: 'Revisa el plan propuesto.', detail: 'Puedes pedir cambios ("quiero más días de pierna", "no tengo barra en casa").' },
      { heading: 'Aprueba.', detail: 'Una vez aprobado, se vuelve tu plan de batalla activo. El Planificador se llena con los entrenamientos.' },
    ],
    tips: [
      { kind: 'pro', text: 'Pide REGENERAR SITREP cuando tu situación cambie — lesión nueva, gimnasio nuevo, cambio de objetivo. Es barato.' },
      { kind: 'tip', text: 'La semana de descarga es intencional. No te la saltes — ahí se consolidan tus ganancias.' },
    ],
  },
  {
    num: '05',
    title: 'Informe Diario',
    whereToFind: 'COC → panel superior.',
    what:
      'Tu inteligencia de la mañana: resumen de ayer, misión de hoy, macros clave, señales de sueño / estrés del wearable, y cualquier ajuste prioritario de tu coach. Auto-generado durante la noche — fresco para cuando despiertas.',
    howTo: [
      { heading: 'Llega a COC.', detail: 'El informe es la tarjeta de arriba.' },
      { heading: 'Léelo una vez antes de entrenar.', detail: 'Está afinado a hoy específicamente — saber la prioridad antes de entrar cambia lo que haces.' },
      { heading: 'Toca cualquier elemento para profundizar.', detail: 'Macros → Nutrición. Entrenamiento → Planificador. Bandera de recuperación → Wearables.' },
    ],
    tips: [
      { kind: 'pro', text: 'Suscríbete a la notificación push matutina (Configuración → Notificaciones) para que el informe llegue a tu pantalla bloqueada.' },
    ],
  },
  {
    num: '06',
    title: 'Intel Center — Perfil, PRs, Nutrición',
    whereToFind: 'Barra inferior → INTEL.',
    what:
      'Tu perfil central. Ocho sub-pestañas: PERFIL (identidad + datos corporales), NUTRICIÓN (macros + comidas), PR BOARD (levantamientos + récords), ANALYTICS (gráficos), LESIONES (activas + historial), MACROCICLO (periodización a largo plazo), PREFERENCIAS (preferencias + persona), WEARABLES (dispositivos), y MANUAL (esta guía).',
    howTo: [
      { heading: 'Abre INTEL.' },
      { heading: 'Navega las sub-pestañas arriba.', detail: 'En móvil son una tira horizontal. En escritorio / iPad se distribuyen arriba.' },
      { heading: 'En PERFIL, mantén tu peso y % de grasa actualizados.', detail: 'Esto alimenta cada cálculo de macros y progresión.' },
      { heading: 'En NUTRICIÓN, registra comidas — manual, por foto, o por búsqueda.', detail: 'Los totales se acumulan. El coach puede leerlos en el chat.' },
      { heading: 'En PR BOARD, registra cada PR.', detail: 'Alimenta el motor de autorregulación — Gunny calcula tus pesos de trabajo de aquí.' },
    ],
    tips: [
      { kind: 'warning', text: 'Si registras un 1RM que no puedes hacer, tus entrenamientos serán muy pesados. Sé honesto.' },
      { kind: 'pro', text: 'ANÁLISIS DE FOTO en Nutrición usa Claude vision — funciona con un plato, una etiqueta nutricional, o un menú.' },
    ],
  },
  {
    num: '07',
    title: 'Wearables',
    whereToFind: 'INTEL → WEARABLES.',
    what:
      'Conecta tu wearable (Apple Watch, Garmin, Whoop, Oura) para alimentar sueño, HRV, y FC en reposo al motor de preparación. Esto determina la recomendación GO_HARD / NORMAL / DELOAD / REST que ves en COC.',
    howTo: [
      { heading: 'Abre INTEL → WEARABLES.' },
      { heading: 'Toca CONECTAR junto a tu dispositivo.', detail: 'Te redirige al flujo OAuth del proveedor — entras con tu cuenta existente.' },
      { heading: 'Aprueba los permisos de datos.', detail: 'Solo pedimos sueño, HRV, FC reposo, y pasos. No jalamos rutas GPS, latidos en streaming, ni nada más.' },
      { heading: 'Espera ~24h para la primera sincronización.', detail: 'Luego revisa el panel de PREPARACIÓN — verás formarse tu línea base.' },
    ],
    tips: [
      { kind: 'tip', text: '¿Sin wearable? Aún puedes usar la app. Califica sueño / estrés / ánimo manualmente cada mañana para alimentar el mismo motor.' },
      { kind: 'warning', text: 'Wearables están en COMMANDER+. Intel te muestra una tarjeta de upgrade si estás abajo.' },
    ],
  },
  {
    num: '08',
    title: 'Notificaciones',
    whereToFind: 'INTEL → PREFERENCIAS → Notificaciones.',
    what:
      'Configura cuándo te avisa la app. Recordatorios de entrenamiento, registros de comida, hidratación, alerta del informe matutino, y check-in nocturno. Todo opcional, todo granular.',
    howTo: [
      { heading: 'Abre INTEL → PREFERENCIAS.' },
      { heading: 'Baja a Notificaciones.' },
      { heading: 'Activa / desactiva cada categoría.', detail: 'Pon horas custom para el informe matutino y el check-in nocturno.' },
      { heading: 'Aprueba el permiso del sistema cuando te lo pida.', detail: 'Sin él, la app no puede enviar push aunque las hayas activado adentro.' },
    ],
    tips: [
      { kind: 'pro', text: 'El check-in matutino de cumplimiento es el de mayor palanca — te dice si tu informe está listo, cuál es tu preparación, y si hoy es día de descanso.' },
    ],
  },
  {
    num: '09',
    title: 'Feedback de Beta',
    whereToFind: 'Menú de configuración (engrane arriba a la derecha) → Beta Feedback.',
    what:
      'Cómo nos cuentas qué está roto o qué te gustaría que existiera. Cada reporte entra a una cola que triamos durante el beta cerrado. Bug, recomendación, UI/UX, rendimiento — elige categoría, escribe descripción, agrega captura.',
    howTo: [
      { heading: 'Toca el icono del engrane arriba.' },
      { heading: 'Selecciona Beta Feedback.' },
      { heading: 'Elige tipo de reporte.', detail: 'BUG / RECOMENDACIÓN / UI/UX / RENDIMIENTO.' },
      { heading: 'Elige severidad.', detail: 'CRÍTICA = app inusable. ALTA = flujo principal roto. MEDIA = molesto. BAJA = sería bonito tener.' },
      { heading: 'Describe qué pasó o qué te gustaría.', detail: 'Mientras más específico, más rápido actuamos.' },
      { heading: 'Adjunta captura si aplica.', detail: 'Opcional pero acelera el triage 10x.' },
    ],
    tips: [
      { kind: 'pro', text: 'Todo lo que envías se lee. Lo etiquetamos NUEVO → REVISANDO → ARREGLADO / NO PROCEDE, y ves el estado en el mismo panel.' },
    ],
  },
  {
    num: '10',
    title: 'Cuenta e Idioma',
    whereToFind: 'Menú de configuración (engrane).',
    what:
      'Lo esencial de tu cuenta: correo, reset de contraseña, idioma, y cerrar sesión. El idioma se fija al registrarte — para cambiarlo necesitas contactar a soporte.',
    howTo: [
      { heading: 'Toca el icono del engrane.' },
      { heading: 'Actualiza tu correo o reset de contraseña desde la fila de cuenta.' },
      { heading: '¿Cambiar EN ↔ ES?', detail: 'Escribe a soporte — cambiamos la bandera en el servidor. El toggle in-app se quitó para evitar cambios accidentales.' },
      { heading: 'Cierra sesión desde abajo del menú.' },
    ],
    tips: [
      { kind: 'tip', text: '¿Olvidaste contraseña? Usa "Recuperar Acceso" en el login — te enviamos un enlace mágico al correo.' },
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────

const OperatingManual: React.FC = () => {
  const { language } = useLanguage();
  const sections = language === 'es' ? SECTIONS_ES : SECTIONS_EN;
  const [expandedNum, setExpandedNum] = useState<string | null>(sections[0]?.num ?? null);

  const labels = language === 'es'
    ? {
        eyebrow: '// MANUAL DEL OPERADOR · GUÍA COMPLETA',
        h1: 'GUNS UP',
        h2: 'Manual del Operador',
        meta1: 'v1.0 · Mayo 2026',
        meta2: 'Cada función explicada · Cómo usarla',
        motto: 'GANADO, NO REGALADO.',
        whereLabel: '// DÓNDE ENCONTRARLO',
        whatLabel: '// QUÉ HACE',
        howLabel: '// CÓMO USARLO',
        tipsLabel: '// CONSEJOS',
        showSteps: 'Ver pasos',
        hideSteps: 'Ocultar pasos',
        kindMap: { tip: 'CONSEJO', warning: 'CUIDADO', pro: 'PRO' },
      }
    : {
        eyebrow: '// OPERATING MANUAL · FULL GUIDE',
        h1: 'GUNS UP',
        h2: 'Operating Manual',
        meta1: 'v1.0 · May 2026',
        meta2: 'Every feature explained · How to use it',
        motto: 'EARNED, NOT GIVEN.',
        whereLabel: '// WHERE TO FIND IT',
        whatLabel: '// WHAT IT DOES',
        howLabel: '// HOW TO USE IT',
        tipsLabel: '// TIPS',
        showSteps: 'Show steps',
        hideSteps: 'Hide steps',
        kindMap: { tip: 'TIP', warning: 'CAUTION', pro: 'PRO' },
      };

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* HEADER — same pattern as OpsRoadmap so the chrome reads consistently */}
      <header style={{ borderBottom: '1px solid var(--border-green-soft)', paddingBottom: 16 }}>
        <div className="t-mono-sm" style={{ color: 'var(--green)', letterSpacing: 2, marginBottom: 6 }}>
          {labels.eyebrow}
        </div>
        <h1 className="t-display-xl" style={{ fontSize: 26, color: 'var(--green)', marginBottom: 4, textShadow: '0 0 12px rgba(0,255,65,0.5)' }}>
          {labels.h1}
        </h1>
        <h2 className="t-display-l" style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 10 }}>
          {labels.h2}
        </h2>
        <div className="t-mono-sm" style={{ color: 'var(--text-secondary)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>{labels.meta1}</span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span>{labels.meta2}</span>
          <span style={{ color: 'var(--text-dim)' }}>|</span>
          <span style={{ color: 'var(--amber)' }}>{labels.motto}</span>
        </div>
      </header>

      {/* SECTIONS — accordion. Default-open is the first one so the
          page never lands blank. Each section is its own bracket card
          so the visual reads like the OpsRoadmap phase cards. */}
      {sections.map((section) => {
        const isOpen = expandedNum === section.num;
        return (
          <section key={section.num}>
            <div
              className="ds-card bracket"
              style={{
                padding: 20,
                borderColor: isOpen ? 'var(--green)' : undefined,
                boxShadow: isOpen ? '0 0 12px rgba(0,255,65,0.18)' : undefined,
              }}
            >
              <span className="bl" /><span className="br" />

              {/* Section eyebrow */}
              <button
                type="button"
                onClick={() => setExpandedNum(isOpen ? null : section.num)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div className="t-eyebrow" style={{ color: 'var(--green)', marginBottom: 4 }}>
                    // {section.num}
                  </div>
                  <h3
                    className="t-display-l"
                    style={{
                      fontSize: 18,
                      color: 'var(--text-bright, #fff)',
                      margin: 0,
                      lineHeight: 1.25,
                    }}
                  >
                    {section.title}
                  </h3>
                </div>
                <span
                  className="t-mono-sm"
                  style={{
                    color: 'var(--green)',
                    flexShrink: 0,
                    paddingTop: 4,
                  }}
                  aria-hidden
                >
                  {isOpen ? '▼' : '▶'}
                </span>
              </button>

              {isOpen && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Where to find */}
                  <div>
                    <div className="t-eyebrow" style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      {labels.whereLabel}
                    </div>
                    <div className="t-body-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {section.whereToFind}
                    </div>
                  </div>

                  {/* What */}
                  <div>
                    <div className="t-eyebrow" style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>
                      {labels.whatLabel}
                    </div>
                    <div className="t-body-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                      {section.what}
                    </div>
                  </div>

                  {/* How */}
                  <div>
                    <div className="t-eyebrow" style={{ color: 'var(--text-tertiary)', marginBottom: 6 }}>
                      {labels.howLabel}
                    </div>
                    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {section.howTo.map((step, idx) => (
                        <li key={idx} className="t-body-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.55 }}>
                          <strong style={{ color: 'var(--green)' }}>{step.heading}</strong>
                          {step.detail && (
                            <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                              {step.detail}
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Tips */}
                  {section.tips && section.tips.length > 0 && (
                    <div>
                      <div className="t-eyebrow" style={{ color: 'var(--text-tertiary)', marginBottom: 6 }}>
                        {labels.tipsLabel}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {section.tips.map((tip, idx) => {
                          const colorMap = {
                            tip: 'var(--green)',
                            warning: '#ff8c00',
                            pro: '#00d4ff',
                          };
                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                gap: 10,
                                padding: '8px 10px',
                                background: 'rgba(255,255,255,0.02)',
                                border: `1px solid ${colorMap[tip.kind]}33`,
                                borderRadius: 3,
                              }}
                            >
                              <span
                                className="t-mono-sm"
                                style={{
                                  color: colorMap[tip.kind],
                                  fontWeight: 700,
                                  letterSpacing: 1.5,
                                  flexShrink: 0,
                                  minWidth: 60,
                                }}
                              >
                                {labels.kindMap[tip.kind]}
                              </span>
                              <span
                                className="t-body-sm"
                                style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}
                              >
                                {tip.text}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default OperatingManual;
