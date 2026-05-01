import { Exercise } from '@/lib/types';

// Exercise library — 214 entries. Each has both EN (`name`) and ES
// (`nameEs`) forms. Spanish translations follow these conventions:
//
//   • Universal English terms stay English: "press" (used in Spanish
//     gyms more than "empuje" for upper-body lifts), "deadlift" stays
//     "Peso Muerto" (universal), "squat" stays "Sentadilla".
//   • Compound names are translated component-by-component in
//     Spanish word order: "Front Squat" → "Sentadilla Frontal",
//     "Bulgarian Split Squat" → "Sentadilla Búlgara".
//   • Equipment qualifiers translate: Barbell→Barra, Dumbbell→Mancuerna,
//     Cable→Polea, Machine→Máquina, Bodyweight→Peso Corporal,
//     Kettlebell→Kettlebell (loanword), Band→Banda, Box→Cajón.
//   • Branded/eponymous lifts keep their proper noun: "Romanian
//     Deadlift" → "Peso Muerto Rumano", "Arnold Press" → "Press Arnold",
//     "Pendlay Row" → "Remo Pendlay", "Kroc Row" → "Remo Kroc".
//   • CrossFit-specific names that are already loanwords in Spanish
//     CrossFit boxes stay as-is or take an accepted Spanish form:
//     "Burpee" → "Burpee", "Wall Ball" → "Wall Ball", "Thrusters" →
//     "Thrusters", "Toes to Bar" → "Toes to Bar".
//   • Use resolveExerciseName(exercise, language) at every render
//     site that knows the operator's language preference.

export const EXERCISE_LIBRARY: Exercise[] = [
  // ═══ SQUAT VARIATIONS ═══
  { id: 'e1', name: 'Back Squat', nameEs: 'Sentadilla Trasera', category: 'Squat', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=ultWZbUMPL8' },
  { id: 'e2', name: 'Front Squat', nameEs: 'Sentadilla Frontal', category: 'Squat', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=m4ytaCJZpl0' },
  { id: 'e3', name: 'Goblet Squat', nameEs: 'Sentadilla Goblet', category: 'Squat', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/watch?v=MeIiIdhvXT4' },
  { id: 'e21', name: 'Leg Press', nameEs: 'Prensa de Piernas', category: 'Squat', equipment: 'Machine', videoUrl: 'https://www.youtube.com/watch?v=IZxyjW7MPJQ' },
  { id: 'e26', name: 'Bulgarian Split Squat', nameEs: 'Sentadilla Búlgara', category: 'Squat', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/watch?v=2C-uNgKwPLE' },
  { id: 'e27', name: 'Lunges', nameEs: 'Zancadas', category: 'Squat', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/watch?v=QOVaHwm-Q6U' },
  { id: 'e46', name: 'Hack Squat', nameEs: 'Sentadilla Hack', category: 'Squat', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=hack+squat' },
  { id: 'e47', name: 'Zercher Squat', nameEs: 'Sentadilla Zercher', category: 'Squat', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=zercher+squat' },
  { id: 'e48', name: 'Overhead Squat', nameEs: 'Sentadilla con Barra Sobre la Cabeza', category: 'Squat', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=overhead+squat' },
  { id: 'e49', name: 'Pause Squat', nameEs: 'Sentadilla con Pausa', category: 'Squat', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=pause+squat' },
  { id: 'e50', name: 'Box Squat', nameEs: 'Sentadilla al Cajón', category: 'Squat', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=box+squat' },
  { id: 'e51', name: 'Safety Bar Squat', nameEs: 'Sentadilla con Barra de Seguridad', category: 'Squat', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=safety+bar+squat' },
  { id: 'e52', name: 'Sissy Squat', nameEs: 'Sentadilla Sissy', category: 'Squat', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=sissy+squat' },
  { id: 'e53', name: 'Pistol Squat', nameEs: 'Sentadilla Pistola', category: 'Squat', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=pistol+squat' },
  { id: 'e54', name: 'Walking Lunges', nameEs: 'Zancadas Caminando', category: 'Squat', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=walking+lunges' },
  { id: 'e55', name: 'Reverse Lunges', nameEs: 'Zancadas Inversas', category: 'Squat', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=reverse+lunges' },
  { id: 'e56', name: 'Lateral Lunges', nameEs: 'Zancadas Laterales', category: 'Squat', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=lateral+lunges' },
  { id: 'e57', name: 'Step Ups', nameEs: 'Subidas al Cajón', category: 'Squat', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=step+ups' },
  { id: 'e58', name: 'Smith Machine Squat', nameEs: 'Sentadilla en Máquina Smith', category: 'Squat', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=smith+machine+squat' },
  { id: 'e59', name: 'Pendulum Squat', nameEs: 'Sentadilla Péndulo', category: 'Squat', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=pendulum+squat' },
  { id: 'e60', name: 'Belt Squat', nameEs: 'Sentadilla con Cinturón', category: 'Squat', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=belt+squat' },

  // ═══ PRESS VARIATIONS ═══
  { id: 'e4', name: 'Bench Press', nameEs: 'Press de Banca', category: 'Press', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=rT7DgCr-3pg' },
  { id: 'e5', name: 'Overhead Press', nameEs: 'Press Militar', category: 'Press', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=2yjwXTZQDDI' },
  { id: 'e6', name: 'Dumbbell Press', nameEs: 'Press con Mancuernas', category: 'Press', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/watch?v=VmB1G1K7v94' },
  { id: 'e7', name: 'Incline Bench Press', nameEs: 'Press Inclinado', category: 'Press', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=SrqOu55lrYU' },
  { id: 'e28', name: 'Dips', nameEs: 'Fondos en Paralelas', category: 'Press', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/watch?v=2z8JmcrW-As' },
  { id: 'e29', name: 'Push Up', nameEs: 'Flexión', category: 'Press', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/watch?v=IODxDxX7oi4' },
  { id: 'e61', name: 'Close Grip Bench Press', nameEs: 'Press de Banca Agarre Cerrado', category: 'Press', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=close+grip+bench+press' },
  { id: 'e62', name: 'Decline Bench Press', nameEs: 'Press Declinado', category: 'Press', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=decline+bench+press' },
  { id: 'e63', name: 'Incline Dumbbell Press', nameEs: 'Press Inclinado con Mancuernas', category: 'Press', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=incline+dumbbell+press' },
  { id: 'e64', name: 'Dumbbell Shoulder Press', nameEs: 'Press de Hombros con Mancuernas', category: 'Press', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=dumbbell+shoulder+press' },
  { id: 'e65', name: 'Arnold Press', nameEs: 'Press Arnold', category: 'Press', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=arnold+press' },
  { id: 'e66', name: 'Push Press', nameEs: 'Push Press', category: 'Press', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=push+press' },
  { id: 'e67', name: 'Floor Press', nameEs: 'Press en el Suelo', category: 'Press', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=floor+press' },
  { id: 'e68', name: 'Landmine Press', nameEs: 'Press Landmine', category: 'Press', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=landmine+press' },
  { id: 'e69', name: 'Machine Chest Press', nameEs: 'Press de Pecho en Máquina', category: 'Press', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=machine+chest+press' },
  { id: 'e70', name: 'Machine Shoulder Press', nameEs: 'Press de Hombros en Máquina', category: 'Press', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=machine+shoulder+press' },
  { id: 'e71', name: 'Smith Machine Bench Press', nameEs: 'Press de Banca en Máquina Smith', category: 'Press', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=smith+machine+bench+press' },
  { id: 'e72', name: 'Cable Chest Press', nameEs: 'Press de Pecho en Polea', category: 'Press', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=cable+chest+press' },
  { id: 'e73', name: 'Diamond Push Up', nameEs: 'Flexión Diamante', category: 'Press', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=diamond+push+up' },
  { id: 'e74', name: 'Pike Push Up', nameEs: 'Flexión Pica', category: 'Press', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=pike+push+up' },
  { id: 'e75', name: 'Dumbbell Fly', nameEs: 'Aperturas con Mancuernas', category: 'Press', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=dumbbell+fly' },
  { id: 'e76', name: 'Incline Dumbbell Fly', nameEs: 'Aperturas Inclinadas con Mancuernas', category: 'Press', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=incline+dumbbell+fly' },
  { id: 'e77', name: 'Cable Fly', nameEs: 'Aperturas en Polea', category: 'Press', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=cable+fly' },
  { id: 'e78', name: 'Cable Crossover', nameEs: 'Cruce de Poleas', category: 'Press', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=cable+crossover' },
  { id: 'e79', name: 'Pec Deck', nameEs: 'Contractor de Pecho', category: 'Press', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=pec+deck' },

  // ═══ HINGE VARIATIONS ═══
  { id: 'e8', name: 'Deadlift', nameEs: 'Peso Muerto', category: 'Hinge', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=op9kVnSso6Q' },
  { id: 'e9', name: 'Romanian Deadlift', nameEs: 'Peso Muerto Rumano', category: 'Hinge', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=7j-2w4-P14I' },
  { id: 'e10', name: 'Sumo Deadlift', nameEs: 'Peso Muerto Sumo', category: 'Hinge', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=lFhWMgnRyjQ' },
  { id: 'e25', name: 'Hip Thrust', nameEs: 'Hip Thrust', category: 'Hinge', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=SEdqd1n0cvg' },
  { id: 'e33', name: 'Kettlebell Swing', nameEs: 'Swing con Kettlebell', category: 'Hinge', equipment: 'Kettlebell', videoUrl: 'https://www.youtube.com/watch?v=YSxHifyI6s8' },
  { id: 'e80', name: 'Trap Bar Deadlift', nameEs: 'Peso Muerto con Barra Hex', category: 'Hinge', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=trap+bar+deadlift' },
  { id: 'e81', name: 'Deficit Deadlift', nameEs: 'Peso Muerto en Déficit', category: 'Hinge', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=deficit+deadlift' },
  { id: 'e82', name: 'Block Pull', nameEs: 'Peso Muerto desde Bloques', category: 'Hinge', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=block+pull' },
  { id: 'e83', name: 'Stiff Leg Deadlift', nameEs: 'Peso Muerto Piernas Rígidas', category: 'Hinge', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=stiff+leg+deadlift' },
  { id: 'e84', name: 'Single Leg RDL', nameEs: 'Peso Muerto Rumano a Una Pierna', category: 'Hinge', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=single+leg+rdl' },
  { id: 'e85', name: 'Dumbbell RDL', nameEs: 'Peso Muerto Rumano con Mancuernas', category: 'Hinge', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=dumbbell+rdl' },
  { id: 'e86', name: 'Good Morning', nameEs: 'Good Morning', category: 'Hinge', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=good+morning' },
  { id: 'e87', name: 'Glute Bridge', nameEs: 'Puente de Glúteos', category: 'Hinge', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=glute+bridge' },
  { id: 'e88', name: 'Cable Pull Through', nameEs: 'Pull Through en Polea', category: 'Hinge', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=cable+pull+through' },
  { id: 'e89', name: 'Hyperextension', nameEs: 'Hiperextensiones', category: 'Hinge', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=hyperextension' },
  { id: 'e90', name: 'Reverse Hyperextension', nameEs: 'Hiperextensiones Inversas', category: 'Hinge', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=reverse+hyperextension' },
  { id: 'e91', name: 'Glute Ham Raise', nameEs: 'Glute Ham Raise', category: 'Hinge', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=glute+ham+raise' },
  { id: 'e92', name: 'Nordic Hamstring Curl', nameEs: 'Curl Nórdico de Femoral', category: 'Hinge', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=nordic+hamstring+curl' },

  // ═══ PULL VARIATIONS ═══
  { id: 'e11', name: 'Pull Up', nameEs: 'Dominada', category: 'Pull', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/watch?v=eGo4IYlbE5g' },
  { id: 'e12', name: 'Chin Up', nameEs: 'Dominada Supina', category: 'Pull', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/watch?v=brhRXlOhWAM' },
  { id: 'e13', name: 'Barbell Row', nameEs: 'Remo con Barra', category: 'Pull', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=FWJR5Ve8bnQ' },
  { id: 'e14', name: 'Dumbbell Row', nameEs: 'Remo con Mancuerna', category: 'Pull', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/watch?v=roCP6wCXPqo' },
  { id: 'e15', name: 'Lat Pulldown', nameEs: 'Jalón al Pecho', category: 'Pull', equipment: 'Cable', videoUrl: 'https://www.youtube.com/watch?v=CAwf7n6Luuc' },
  { id: 'e16', name: 'Cable Row', nameEs: 'Remo en Polea', category: 'Pull', equipment: 'Cable', videoUrl: 'https://www.youtube.com/watch?v=GZbfZ033f74' },
  { id: 'e20', name: 'Face Pull', nameEs: 'Face Pull', category: 'Pull', equipment: 'Cable', videoUrl: 'https://www.youtube.com/watch?v=rep-qVOkqgk' },
  { id: 'e93', name: 'Pendlay Row', nameEs: 'Remo Pendlay', category: 'Pull', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=pendlay+row' },
  { id: 'e94', name: 'T-Bar Row', nameEs: 'Remo en Barra T', category: 'Pull', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=t-bar+row' },
  { id: 'e95', name: 'Meadows Row', nameEs: 'Remo Meadows', category: 'Pull', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=meadows+row' },
  { id: 'e96', name: 'Seal Row', nameEs: 'Remo Foca', category: 'Pull', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=seal+row' },
  { id: 'e97', name: 'Chest Supported Row', nameEs: 'Remo con Pecho Apoyado', category: 'Pull', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=chest+supported+row' },
  { id: 'e98', name: 'Kroc Row', nameEs: 'Remo Kroc', category: 'Pull', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=kroc+row' },
  { id: 'e99', name: 'Wide Grip Lat Pulldown', nameEs: 'Jalón al Pecho Agarre Abierto', category: 'Pull', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=wide+grip+lat+pulldown' },
  { id: 'e100', name: 'Close Grip Lat Pulldown', nameEs: 'Jalón al Pecho Agarre Cerrado', category: 'Pull', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=close+grip+lat+pulldown' },
  { id: 'e101', name: 'Straight Arm Pulldown', nameEs: 'Jalón con Brazos Rectos', category: 'Pull', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=straight+arm+pulldown' },
  { id: 'e102', name: 'Machine Row', nameEs: 'Remo en Máquina', category: 'Pull', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=machine+row' },
  { id: 'e103', name: 'Inverted Row', nameEs: 'Remo Invertido', category: 'Pull', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=inverted+row' },
  { id: 'e104', name: 'Shrugs', nameEs: 'Encogimientos con Barra', category: 'Pull', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=barbell+shrugs' },
  { id: 'e105', name: 'Dumbbell Shrugs', nameEs: 'Encogimientos con Mancuernas', category: 'Pull', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=dumbbell+shrugs' },
  { id: 'e106', name: 'Rack Pull', nameEs: 'Rack Pull', category: 'Pull', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=rack+pull' },
  { id: 'e107', name: 'Neutral Grip Pull Up', nameEs: 'Dominada Agarre Neutro', category: 'Pull', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=neutral+grip+pull+up' },

  // ═══ ISOLATION — ARMS ═══
  { id: 'e17', name: 'Bicep Curl', nameEs: 'Curl de Bíceps', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/watch?v=ykJmrZ5v0Oo' },
  { id: 'e18', name: 'Tricep Pushdown', nameEs: 'Extensión de Tríceps en Polea', category: 'Isolation', equipment: 'Cable', videoUrl: 'https://www.youtube.com/watch?v=2-LAMcpzODU' },
  { id: 'e108', name: 'Barbell Curl', nameEs: 'Curl con Barra', category: 'Isolation', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=barbell+curl' },
  { id: 'e109', name: 'Hammer Curl', nameEs: 'Curl Martillo', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=hammer+curl' },
  { id: 'e110', name: 'Preacher Curl', nameEs: 'Curl en Banco Predicador', category: 'Isolation', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=preacher+curl' },
  { id: 'e111', name: 'Incline Dumbbell Curl', nameEs: 'Curl Inclinado con Mancuernas', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=incline+dumbbell+curl' },
  { id: 'e112', name: 'Cable Curl', nameEs: 'Curl en Polea', category: 'Isolation', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=cable+curl' },
  { id: 'e113', name: 'Concentration Curl', nameEs: 'Curl Concentrado', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=concentration+curl' },
  { id: 'e114', name: 'Spider Curl', nameEs: 'Curl Spider', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=spider+curl' },
  { id: 'e115', name: 'EZ Bar Curl', nameEs: 'Curl con Barra Z', category: 'Isolation', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=ez+bar+curl' },
  { id: 'e116', name: 'Skull Crusher', nameEs: 'Press Francés', category: 'Isolation', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=skull+crusher' },
  { id: 'e117', name: 'Overhead Tricep Extension', nameEs: 'Extensión de Tríceps por Encima de la Cabeza', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=overhead+tricep+extension' },
  { id: 'e118', name: 'Tricep Kickback', nameEs: 'Patada de Tríceps', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=tricep+kickback' },
  { id: 'e119', name: 'Cable Overhead Tricep Extension', nameEs: 'Extensión de Tríceps en Polea Sobre la Cabeza', category: 'Isolation', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=cable+overhead+tricep+extension' },
  { id: 'e120', name: 'Rope Pushdown', nameEs: 'Extensión de Tríceps con Cuerda', category: 'Isolation', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=rope+pushdown' },
  { id: 'e121', name: 'Wrist Curl', nameEs: 'Curl de Muñeca', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=wrist+curl' },
  { id: 'e122', name: 'Reverse Curl', nameEs: 'Curl Inverso', category: 'Isolation', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=reverse+curl' },

  // ═══ ISOLATION — SHOULDERS ═══
  { id: 'e19', name: 'Lateral Raise', nameEs: 'Elevaciones Laterales', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/watch?v=3VcKaXpzqRo' },
  { id: 'e123', name: 'Cable Lateral Raise', nameEs: 'Elevaciones Laterales en Polea', category: 'Isolation', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=cable+lateral+raise' },
  { id: 'e124', name: 'Machine Lateral Raise', nameEs: 'Elevaciones Laterales en Máquina', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=machine+lateral+raise' },
  { id: 'e125', name: 'Front Raise', nameEs: 'Elevaciones Frontales', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=front+raise' },
  { id: 'e126', name: 'Rear Delt Fly', nameEs: 'Aperturas Posteriores', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=rear+delt+fly' },
  { id: 'e127', name: 'Reverse Pec Deck', nameEs: 'Contractor Inverso', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=reverse+pec+deck' },
  { id: 'e128', name: 'Cable Rear Delt Fly', nameEs: 'Aperturas Posteriores en Polea', category: 'Isolation', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=cable+rear+delt+fly' },
  { id: 'e129', name: 'Upright Row', nameEs: 'Remo al Mentón', category: 'Isolation', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=upright+row' },
  { id: 'e130', name: 'Lu Raise', nameEs: 'Elevación Lu', category: 'Isolation', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=lu+raise' },

  // ═══ ISOLATION — LEGS ═══
  { id: 'e22', name: 'Leg Curl', nameEs: 'Curl de Piernas', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/watch?v=1Tq3QdYUuHs' },
  { id: 'e23', name: 'Leg Extension', nameEs: 'Extensión de Piernas', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/watch?v=YyvSfVjQeL0' },
  { id: 'e24', name: 'Calf Raise', nameEs: 'Elevación de Pantorrillas', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/watch?v=gwLzBJYoWlI' },
  { id: 'e131', name: 'Seated Calf Raise', nameEs: 'Elevación de Pantorrillas Sentado', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=seated+calf+raise' },
  { id: 'e132', name: 'Standing Calf Raise', nameEs: 'Elevación de Pantorrillas de Pie', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=standing+calf+raise' },
  { id: 'e133', name: 'Seated Leg Curl', nameEs: 'Curl de Piernas Sentado', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=seated+leg+curl' },
  { id: 'e134', name: 'Hip Adductor Machine', nameEs: 'Máquina Aductores', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=hip+adductor+machine' },
  { id: 'e135', name: 'Hip Abductor Machine', nameEs: 'Máquina Abductores', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=hip+abductor+machine' },
  { id: 'e136', name: 'Donkey Calf Raise', nameEs: 'Elevación de Pantorrillas Burro', category: 'Isolation', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=donkey+calf+raise' },
  { id: 'e137', name: 'Tibialis Raise', nameEs: 'Elevación de Tibial Anterior', category: 'Isolation', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=tibialis+raise' },

  // ═══ CORE ═══
  { id: 'e30', name: 'Plank', nameEs: 'Plancha', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/watch?v=ASdvN_XEl_c' },
  { id: 'e31', name: 'Russian Twist', nameEs: 'Giro Ruso', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/watch?v=wkD8rjkodUI' },
  { id: 'e32', name: 'Hanging Leg Raise', nameEs: 'Elevación de Piernas Colgado', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/watch?v=hdng3Nm1x_E' },
  { id: 'e138', name: 'Ab Rollout', nameEs: 'Rueda Abdominal', category: 'Core', equipment: 'Ab Wheel', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=ab+rollout' },
  { id: 'e139', name: 'Cable Crunch', nameEs: 'Crunch en Polea', category: 'Core', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=cable+crunch' },
  { id: 'e140', name: 'Pallof Press', nameEs: 'Press Pallof', category: 'Core', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=pallof+press' },
  { id: 'e141', name: 'Dead Bug', nameEs: 'Dead Bug', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=dead+bug' },
  { id: 'e142', name: 'Bird Dog', nameEs: 'Bird Dog', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=bird+dog' },
  { id: 'e143', name: 'Side Plank', nameEs: 'Plancha Lateral', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=side+plank' },
  { id: 'e144', name: 'V-Up', nameEs: 'V-Ups', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=v+up' },
  { id: 'e145', name: 'Toes to Bar', nameEs: 'Toes to Bar', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=toes+to+bar' },
  { id: 'e146', name: 'Sit Up', nameEs: 'Abdominales', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=sit+up' },
  { id: 'e147', name: 'GHD Sit Up', nameEs: 'GHD Sit Up', category: 'Core', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=ghd+sit+up' },
  { id: 'e148', name: 'Bicycle Crunch', nameEs: 'Crunch Bicicleta', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=bicycle+crunch' },
  { id: 'e149', name: 'Woodchop', nameEs: 'Leñador en Polea', category: 'Core', equipment: 'Cable', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=woodchop' },
  { id: 'e150', name: 'Suitcase Carry', nameEs: 'Suitcase Carry', category: 'Core', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=suitcase+carry' },
  { id: 'e151', name: 'Farmers Walk', nameEs: 'Paseo del Granjero', category: 'Core', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=farmers+walk' },
  { id: 'e152', name: 'Dragon Flag', nameEs: 'Bandera del Dragón', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=dragon+flag' },
  { id: 'e153', name: 'L-Sit', nameEs: 'L-Sit', category: 'Core', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=l+sit' },

  // ═══ OLYMPIC LIFTS ═══
  { id: 'e35', name: 'Clean and Jerk', nameEs: 'Cargada y Envión', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=PjY1rJ4DNBs' },
  { id: 'e36', name: 'Snatch', nameEs: 'Arrancada', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=tuOepRCJMWs' },
  { id: 'e37', name: 'Power Clean', nameEs: 'Cargada de Potencia', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/watch?v=GVt3pUBSGWI' },
  { id: 'e154', name: 'Hang Clean', nameEs: 'Cargada Colgante', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=hang+clean' },
  { id: 'e155', name: 'Hang Snatch', nameEs: 'Arrancada Colgante', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=hang+snatch' },
  { id: 'e156', name: 'Power Snatch', nameEs: 'Arrancada de Potencia', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=power+snatch' },
  { id: 'e157', name: 'Clean Pull', nameEs: 'Halón de Cargada', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=clean+pull' },
  { id: 'e158', name: 'Snatch Pull', nameEs: 'Halón de Arrancada', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=snatch+pull' },
  { id: 'e159', name: 'Split Jerk', nameEs: 'Envión con Tijera', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=split+jerk' },
  { id: 'e160', name: 'Push Jerk', nameEs: 'Envión de Empuje', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=push+jerk' },
  { id: 'e161', name: 'Muscle Clean', nameEs: 'Cargada Muscular', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=muscle+clean' },
  { id: 'e162', name: 'Muscle Snatch', nameEs: 'Arrancada Muscular', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=muscle+snatch' },
  { id: 'e163', name: 'Clean and Press', nameEs: 'Cargada y Press', category: 'Olympic', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=clean+and+press' },

  // ═══ CONDITIONING ═══
  { id: 'e39', name: 'Burpee', nameEs: 'Burpee', category: 'Conditioning', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/watch?v=dZgVxmf6jkA' },
  { id: 'e40', name: 'Wall Ball', nameEs: 'Wall Ball', category: 'Conditioning', equipment: 'Medicine Ball', videoUrl: 'https://www.youtube.com/watch?v=fpUD0mcFp_0' },
  { id: 'e41', name: 'Rowing', nameEs: 'Remo Ergómetro', category: 'Conditioning', equipment: 'Rower', videoUrl: 'https://www.youtube.com/watch?v=zQ82RYIFLN8' },
  { id: 'e42', name: 'Assault Bike', nameEs: 'Assault Bike', category: 'Conditioning', equipment: 'Bike', videoUrl: 'https://www.youtube.com/watch?v=nMHxCQTJQqo' },
  { id: 'e43', name: 'Double Unders', nameEs: 'Double Unders', category: 'Conditioning', equipment: 'Jump Rope', videoUrl: 'https://www.youtube.com/watch?v=82jNjDS19lg' },
  { id: 'e164', name: 'Battle Ropes', nameEs: 'Cuerdas de Batalla', category: 'Conditioning', equipment: 'Rope', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=battle+ropes' },
  { id: 'e165', name: 'Sled Push', nameEs: 'Empuje de Trineo', category: 'Conditioning', equipment: 'Sled', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=sled+push' },
  { id: 'e166', name: 'Sled Pull', nameEs: 'Arrastre de Trineo', category: 'Conditioning', equipment: 'Sled', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=sled+pull' },
  { id: 'e167', name: 'Ski Erg', nameEs: 'Ski Erg', category: 'Conditioning', equipment: 'Machine', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=ski+erg' },
  { id: 'e168', name: 'Running', nameEs: 'Correr', category: 'Conditioning', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=running+form' },
  { id: 'e169', name: 'Sprint', nameEs: 'Sprint', category: 'Conditioning', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=sprint' },
  { id: 'e170', name: 'Jump Rope', nameEs: 'Comba', category: 'Conditioning', equipment: 'Jump Rope', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=jump+rope' },
  { id: 'e171', name: 'Thrusters', nameEs: 'Thrusters', category: 'Conditioning', equipment: 'Barbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=thrusters' },
  { id: 'e172', name: 'Dumbbell Thrusters', nameEs: 'Thrusters con Mancuernas', category: 'Conditioning', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=dumbbell+thrusters' },
  { id: 'e173', name: 'Mountain Climbers', nameEs: 'Escaladores', category: 'Conditioning', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=mountain+climbers' },
  { id: 'e174', name: 'Bear Crawl', nameEs: 'Andar de Oso', category: 'Conditioning', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=bear+crawl' },
  { id: 'e175', name: 'Man Maker', nameEs: 'Man Maker', category: 'Conditioning', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=man+maker' },
  { id: 'e176', name: 'Devil Press', nameEs: 'Devil Press', category: 'Conditioning', equipment: 'Dumbbell', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=devil+press' },
  { id: 'e177', name: 'Bike Sprint', nameEs: 'Sprint en Bicicleta', category: 'Conditioning', equipment: 'Bike', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=bike+sprint' },

  // ═══ PLYOMETRIC ═══
  { id: 'e38', name: 'Box Jump', nameEs: 'Salto al Cajón', category: 'Plyometric', equipment: 'Box', videoUrl: 'https://www.youtube.com/watch?v=NBY9-kTuHEk' },
  { id: 'e178', name: 'Broad Jump', nameEs: 'Salto Horizontal', category: 'Plyometric', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=broad+jump' },
  { id: 'e179', name: 'Depth Jump', nameEs: 'Salto en Profundidad', category: 'Plyometric', equipment: 'Box', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=depth+jump' },
  { id: 'e180', name: 'Plyo Push Up', nameEs: 'Flexión Pliométrica', category: 'Plyometric', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=plyo+push+up' },
  { id: 'e181', name: 'Jump Squat', nameEs: 'Sentadilla con Salto', category: 'Plyometric', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=jump+squat' },
  { id: 'e182', name: 'Tuck Jump', nameEs: 'Salto Agrupado', category: 'Plyometric', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=tuck+jump' },
  { id: 'e183', name: 'Lateral Box Jump', nameEs: 'Salto Lateral al Cajón', category: 'Plyometric', equipment: 'Box', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=lateral+box+jump' },
  { id: 'e184', name: 'Medicine Ball Slam', nameEs: 'Slam de Balón Medicinal', category: 'Plyometric', equipment: 'Medicine Ball', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=medicine+ball+slam' },
  { id: 'e185', name: 'Medicine Ball Throw', nameEs: 'Lanzamiento de Balón Medicinal', category: 'Plyometric', equipment: 'Medicine Ball', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=medicine+ball+throw' },

  // ═══ GYMNASTICS ═══
  { id: 'e44', name: 'Muscle Up', nameEs: 'Muscle Up', category: 'Gymnastics', equipment: 'Rings', videoUrl: 'https://www.youtube.com/watch?v=astFEUaW-AM' },
  { id: 'e45', name: 'Handstand Push Up', nameEs: 'Flexión en Pino', category: 'Gymnastics', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/watch?v=sJ5m0s9NUBE' },
  { id: 'e186', name: 'Ring Dip', nameEs: 'Fondos en Anillas', category: 'Gymnastics', equipment: 'Rings', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=ring+dip' },
  { id: 'e187', name: 'Ring Row', nameEs: 'Remo en Anillas', category: 'Gymnastics', equipment: 'Rings', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=ring+row' },
  { id: 'e188', name: 'Bar Muscle Up', nameEs: 'Muscle Up en Barra', category: 'Gymnastics', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=bar+muscle+up' },
  { id: 'e189', name: 'Handstand Walk', nameEs: 'Caminar en Pino', category: 'Gymnastics', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=handstand+walk' },
  { id: 'e190', name: 'Rope Climb', nameEs: 'Trepa de Cuerda', category: 'Gymnastics', equipment: 'Rope', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=rope+climb' },
  { id: 'e191', name: 'Skin the Cat', nameEs: 'Skin the Cat', category: 'Gymnastics', equipment: 'Rings', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=skin+the+cat' },

  // ═══ FULL BODY ═══
  { id: 'e34', name: 'Turkish Get Up', nameEs: 'Turkish Get Up', category: 'Full Body', equipment: 'Kettlebell', videoUrl: 'https://www.youtube.com/watch?v=0bWRPC49-KI' },
  { id: 'e192', name: 'Sandbag Clean', nameEs: 'Cargada con Saco de Arena', category: 'Full Body', equipment: 'Sandbag', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=sandbag+clean' },
  { id: 'e193', name: 'Stone to Shoulder', nameEs: 'Piedra al Hombro', category: 'Full Body', equipment: 'Stone', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=stone+to+shoulder' },
  { id: 'e194', name: 'Tire Flip', nameEs: 'Volteo de Llanta', category: 'Full Body', equipment: 'Tire', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=tire+flip' },
  { id: 'e195', name: 'Prowler Push', nameEs: 'Empuje de Prowler', category: 'Full Body', equipment: 'Sled', videoUrl: 'https://www.youtube.com/@OPEXFitness/search?query=prowler+push' },

  // ═══ MOBILITY / STRETCH ═══
  { id: 'e196', name: 'Foam Roll', nameEs: 'Rodillo de Espuma', category: 'Mobility', equipment: 'Foam Roller', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=foam+rolling' },
  { id: 'e197', name: 'Lacrosse Ball Release', nameEs: 'Liberación con Pelota de Lacrosse', category: 'Mobility', equipment: 'Ball', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=lacrosse+ball+release' },
  { id: 'e198', name: 'Couch Stretch', nameEs: 'Estiramiento del Sofá', category: 'Mobility', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=couch+stretch' },
  { id: 'e199', name: '90/90 Stretch', nameEs: 'Estiramiento 90/90', category: 'Mobility', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=90+90+stretch' },
  { id: 'e200', name: 'World\'s Greatest Stretch', nameEs: 'El Mejor Estiramiento del Mundo', category: 'Mobility', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=worlds+greatest+stretch' },
  { id: 'e201', name: 'Cat Cow', nameEs: 'Gato Vaca', category: 'Mobility', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=cat+cow' },
  { id: 'e202', name: 'Band Pull Apart', nameEs: 'Apertura con Banda', category: 'Mobility', equipment: 'Band', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=band+pull+apart' },
  { id: 'e203', name: 'Band Dislocate', nameEs: 'Dislocación con Banda', category: 'Mobility', equipment: 'Band', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=band+dislocate' },
  { id: 'e204', name: 'Pigeon Stretch', nameEs: 'Estiramiento de Paloma', category: 'Mobility', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=pigeon+stretch' },
  { id: 'e205', name: 'Child\'s Pose', nameEs: 'Postura del Niño', category: 'Mobility', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=childs+pose' },
  { id: 'e206', name: 'Scorpion Stretch', nameEs: 'Estiramiento de Escorpión', category: 'Mobility', equipment: 'Bodyweight', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=scorpion+stretch' },
  { id: 'e207', name: 'Hip Circle', nameEs: 'Círculo de Cadera', category: 'Mobility', equipment: 'Band', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=hip+circle' },
  { id: 'e208', name: 'Banded Good Morning', nameEs: 'Good Morning con Banda', category: 'Mobility', equipment: 'Band', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=banded+good+morning' },

  // ═══ KETTLEBELL ═══
  { id: 'e209', name: 'Kettlebell Goblet Squat', nameEs: 'Sentadilla Goblet con Kettlebell', category: 'Full Body', equipment: 'Kettlebell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=kettlebell+goblet+squat' },
  { id: 'e210', name: 'Kettlebell Clean', nameEs: 'Cargada con Kettlebell', category: 'Full Body', equipment: 'Kettlebell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=kettlebell+clean' },
  { id: 'e211', name: 'Kettlebell Snatch', nameEs: 'Arrancada con Kettlebell', category: 'Full Body', equipment: 'Kettlebell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=kettlebell+snatch' },
  { id: 'e212', name: 'Kettlebell Press', nameEs: 'Press con Kettlebell', category: 'Full Body', equipment: 'Kettlebell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=kettlebell+press' },
  { id: 'e213', name: 'Kettlebell Windmill', nameEs: 'Molino con Kettlebell', category: 'Full Body', equipment: 'Kettlebell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=kettlebell+windmill' },
  { id: 'e214', name: 'Kettlebell Halo', nameEs: 'Halo con Kettlebell', category: 'Mobility', equipment: 'Kettlebell', videoUrl: 'https://www.youtube.com/@marcusfilly/search?query=kettlebell+halo' },
];

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Resolve the display name for an exercise based on the operator's
 * language preference. Falls back to the EN `name` when:
 *   - Language is not 'es' (default)
 *   - The exercise predates Phase B and has no `nameEs` set
 *   - The argument is just an exercise NAME (string), in which case
 *     we look up the entry in EXERCISE_LIBRARY by case-insensitive
 *     name match. If the lookup misses, we return the input verbatim
 *     — useful for AI-generated workouts where the exercise name may
 *     not exist in the static library.
 *
 * Use this at every render site that displays an exercise name to a
 * user whose `language` preference is known. Workout JSON in the DB
 * keeps the EN name baked in (workouts.blocks[].exerciseName) so
 * historical data never shifts language under the operator.
 */
export function resolveExerciseName(
  exerciseOrName: Exercise | string,
  language: 'en' | 'es' | undefined,
): string {
  if (typeof exerciseOrName === 'string') {
    if (language !== 'es') return exerciseOrName;
    const match = EXERCISE_LIBRARY.find(
      ex => ex.name.toLowerCase() === exerciseOrName.toLowerCase(),
    );
    return match?.nameEs ?? exerciseOrName;
  }
  if (language !== 'es') return exerciseOrName.name;
  return exerciseOrName.nameEs ?? exerciseOrName.name;
}

// Helper: look up video URL by exercise name, with YouTube search fallback.
// Matches against EN name only — workout blocks store the EN form, and the
// fallback search query also uses EN. ES users get the same video links;
// videos themselves are mostly English-language demonstrations.
export function getVideoUrl(exerciseName: string): string {
  const exercise = EXERCISE_LIBRARY.find(
    ex => ex.name.toLowerCase() === exerciseName.toLowerCase()
  );
  if (exercise?.videoUrl) return exercise.videoUrl;
  // Fallback: generate YouTube search URL so no exercise goes without a video
  const searchQuery = exerciseName.replace(/\s+/g, '+').toLowerCase();
  return `https://www.youtube.com/results?search_query=${searchQuery}+form+tutorial`;
}
