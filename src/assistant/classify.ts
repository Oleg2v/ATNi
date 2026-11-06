export type Intent = 'results' | 'health' | 'general' | 'empty';

const HEALTH_PHRASES = [
  'lose weight', 'weight loss', 'blood pressure', 'should i eat', 'can i eat', 'is it healthy for me', 'my child', 'my baby', 'calories should', 'how much sugar should', 'meal plan', 'good for my', 'bad for my', 'safe for my',
  // Swahili
  'mlo wangu', 'nipunguze uzito', 'kupunguza uzito', 'shinikizo la damu', 'mtoto wangu', 'niko mgonjwa', 'afya yangu', 'nzuri kwa',
];
/** single words matched on word boundaries so that e.g. "treat" does not match "treatment of data" by accident */
const HEALTH_WORDS = ['diet', 'diets', 'diabetes', 'diabetic', 'cholesterol', 'pregnant', 'pregnancy', 'allergy', 'allergic', 'medical', 'medicine', 'medication', 'doctor', 'symptom', 'symptoms', 'dose', 'dosage', 'supplement', 'supplements', 'disease', 'illness', 'nutritionist', 'kisukari', 'mjamzito', 'daktari', 'dawa', 'ugonjwa', 'nile'];

const RESULTS_STRONG = ['why did i', 'why do i', 'why have i', 'why is my', 'why was my', 'my score', 'my grade', 'my letter', 'my result', 'my results', 'my roadmap', 'my points', 'i scored', 'we scored', 'our score', 'our result',
  // Swahili
  'kwa nini ni', 'kwa nini nime', 'alama yangu', 'alama zangu', 'daraja langu', 'matokeo yangu', 'nimepata', 'tumepata'];
const TOPIC_WORDS = ['marketing', 'labelling', 'labeling', 'workforce', 'engagement', 'products', 'management', 'masoko', 'lebo', 'wafanyakazi', 'ushirikiano', 'bidhaa'];
const PERSONAL = [' my ', ' i ', ' me ', ' we ', ' our ', 'yangu', 'yetu', 'nime', 'nina', 'tume'];

const wordRe = (w: string) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, 'iu');

/** Rule-based intent classification. Health questions are declined; results questions use the score context. */
export function classify(question: string): Intent {
  const q = ` ${question.toLowerCase().trim()} `;
  if (q.trim().length === 0) return 'empty';
  if (HEALTH_PHRASES.some((h) => q.includes(h)) || HEALTH_WORDS.some((w) => wordRe(w).test(q))) return 'health';
  if (RESULTS_STRONG.some((r) => q.includes(r))) return 'results';
  if (TOPIC_WORDS.some((r) => q.includes(r)) && PERSONAL.some((p) => q.includes(p))) return 'results';
  if (/\bwhy\b/.test(q) && (TOPIC_WORDS.some((r) => q.includes(r)) || /\b[a-e]\b/.test(q))) return 'results';
  return 'general';
}
