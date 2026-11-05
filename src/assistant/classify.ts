export type Intent = 'results' | 'health' | 'general' | 'empty';

const HEALTH = [
  'diet', 'lose weight', 'weight loss', 'diabetes', 'diabetic', 'blood pressure', 'cholesterol', 'should i eat', 'can i eat', 'is it healthy for me', 'my child', 'my baby', 'pregnan', 'allergy', 'allergic', 'medic', 'doctor', 'symptom', 'dose', 'supplement', 'calories should', 'how much sugar should', 'treat', 'disease', 'illness', 'nutritionist', 'meal plan',
  // Swahili
  'mlo wangu', 'nipunguze uzito', 'kupunguza uzito', 'kisukari', 'shinikizo la damu', 'nile', 'mtoto wangu', 'mjamzito', 'daktari', 'dawa', 'ugonjwa', 'niko mgonjwa', 'afya yangu',
];

const RESULTS_STRONG = ['score', 'grade', 'letter', 'why', 'points', ' my result', 'got a ', 'got an ', 'got c', 'got d', 'got b', 'got e',
  // Swahili
  'alama', 'daraja', 'herufi', 'kwa nini', 'matokeo yangu', 'nimepata'];
const TOPIC_WORDS = ['marketing', 'labelling', 'labeling', 'workforce', 'engagement', 'products', 'management', 'topic', 'masoko', 'lebo', 'wafanyakazi', 'ushirikiano', 'bidhaa', 'mada'];
const PERSONAL = [' my ', ' i ', ' me ', 'yangu', 'nime', 'nina'];

/** Rule-based intent classification. Health questions are declined; results questions use the score context. */
export function classify(question: string): Intent {
  const q = ` ${question.toLowerCase().trim()} `;
  if (q.trim().length === 0) return 'empty';
  if (HEALTH.some((h) => q.includes(h))) return 'health';
  if (RESULTS_STRONG.some((r) => q.includes(r))) return 'results';
  if (TOPIC_WORDS.some((r) => q.includes(r)) && PERSONAL.some((p) => q.includes(p))) return 'results';
  return 'general';
}
