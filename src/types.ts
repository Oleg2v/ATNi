/**
 * Core data model.
 *
 * The question format is field-compatible with the NutriCheck survey.json format
 * (topic, question, question_id, info, dependency, propositions, recommandations).
 * Fields prefixed with `x_` are hub extensions and are ignored by the original format.
 * No content from the NutriCheck repository is reused: all questions, recommendations
 * and numbers in this prototype are synthetic.
 */

export type Lang = 'en' | 'sw';
export type CountryCode = 'KE' | 'TZ' | 'NG' | 'SN' | 'ID' | 'BD';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';
export type Phase = 'now' | 'next' | 'later';
export type Role = 'company' | 'content' | 'methodology' | 'analyst' | 'admin';
export type CompanySize = 'micro' | 'small' | 'medium' | 'large';

/* ---------- Survey-compatible question format ---------- */

export interface OptionProposition {
  proposition: string;
  score: number;
  text_inputs?: boolean;
}

export interface OptionPropositions {
  type: 'option';
  propositions: OptionProposition[];
}

export interface ChoicesPropositions {
  type: 'choices';
  propositions: string[];
  count_score_map?: number[];
  count_score_coeff?: number;
  none_of_the_above?: boolean;
}

export interface TextPropositions {
  type: 'text';
  proposition: string;
}

export type Propositions = OptionPropositions | ChoicesPropositions | TextPropositions;

export interface FixedRecommendation {
  type: 'fixed';
  recommandation: string;
  /** hub extension: stable id used by the roadmap rules and translations */
  x_id?: string;
}

export interface ScoredRecommendationEntry {
  score: number;
  recommandation: string;
  x_id?: string;
}

export interface ScoredRecommendation {
  type: 'scored';
  recommandations: ScoredRecommendationEntry[];
}

export type Recommandations = FixedRecommendation | ScoredRecommendation | null;

export interface Question {
  topic: string;
  question: string;
  question_id: string;
  info?: string;
  /** parent question id (NutriCheck semantics: shown when parent answered and not "No" / at least one box ticked) */
  dependency?: string;
  recommandations?: Recommandations;
  propositions: Propositions;
  /** hub extension: show only when the parent's answer equals this exact value (option) or includes it (choices) */
  x_dependency_answer?: string;
}

/* ---------- Hub extensions ---------- */

export interface RoadmapRule {
  id: string;
  question_id: string;
  /** rule fires when the question's achieved share of its maximum is at or below this fraction (0..1) */
  max_share?: number;
  /** rule fires when the exact score matches */
  score_eq?: number;
  phase: Phase;
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  /** recommendation id (x_id) this step is based on */
  rec_id: string;
  title: string;
}

export interface TopicDef {
  id: string;
  name: string;
}

export interface GradeThreshold {
  grade: Grade;
  min_percent: number;
}

export interface SwTranslations {
  topics?: Record<string, string>;
  questions?: Record<
    string,
    {
      question?: string;
      info?: string;
      propositions?: string[];
      text_proposition?: string;
    }
  >;
  recommendations?: Record<string, string>;
  roadmap_titles?: Record<string, string>;
}

export type VersionStatus = 'published' | 'draft' | 'archived';

export interface MethodologyVersion {
  id: string;
  version: string;
  tool: 'self-assessment';
  /** '*' = shared across countries; otherwise a country code */
  country: CountryCode | '*';
  status: VersionStatus;
  created_at: string;
  published_at?: string;
  published_by?: string;
  comment?: string;
  based_on?: string;
  grading: GradeThreshold[];
  topics: TopicDef[];
  questions: Question[];
  roadmap_rules: RoadmapRule[];
  translations: { sw: SwTranslations };
  /** hub extension for country copies */
  national_thresholds?: 'to be provided' | 'provided';
}

/* ---------- Answers and assessments ---------- */

/** option: selected label (+ optional text); choices: selected labels; text: free text */
export type AnswerValue =
  | { type: 'option'; selected: string; text?: string }
  | { type: 'choices'; selected: string[]; none?: boolean }
  | { type: 'text'; text: string };

export type Answers = Record<string, AnswerValue>;

export interface Assessment {
  id: string;
  company_id: string;
  company_name: string;
  country: CountryCode;
  company_size: CompanySize;
  lang: Lang;
  version_id: string;
  started_at: string;
  completed_at: string | null;
  answers: Answers;
  /** stored at completion time: results are frozen to the version used */
  result?: AssessmentResult;
  consent_investor_share: boolean;
  plan_downloaded?: boolean;
}

export interface QuestionScore {
  question_id: string;
  topic: string;
  score: number;
  max: number;
  applicable: boolean;
  answered: boolean;
  answer_label: string;
}

export interface TopicScore {
  topic: string;
  score: number;
  max: number;
  percent: number;
  grade: Grade;
}

export interface AssessmentResult {
  version_id: string;
  computed_at: string;
  total: number;
  max: number;
  percent: number;
  grade: Grade;
  topics: TopicScore[];
  questions: QuestionScore[];
}

/* ---------- Companies, countries ---------- */

export interface Company {
  id: string;
  name: string;
  country: CountryCode;
  size: CompanySize;
  sector: string;
  is_current_user?: boolean;
}

export interface CountryDef {
  code: CountryCode;
  name: string;
  name_sw: string;
  status: 'active' | 'planned';
  languages: Lang[];
  methodology_version_id?: string;
}

/* ---------- Knowledge base ---------- */

export interface KbDoc {
  id: string;
  kind: 'article' | 'faq' | 'methodology';
  title: string;
  title_sw?: string;
  body: string;
  body_sw?: string;
  tags: string[];
  topic?: string;
}

/* ---------- Calculator ---------- */

export interface Nutrients {
  energy_kj: number;
  sugars_g: number;
  sat_fat_g: number;
  salt_g: number;
  fibre_g: number;
  protein_g: number;
  fvl_percent: number;
}

/* ---------- Admin / platform ---------- */

export interface AuditEntry {
  id: string;
  at: string;
  actor_role: Role;
  action: string;
  target: string;
  details?: string;
  /** optional snapshot for rollback */
  snapshot?: unknown;
}

export interface HandoffTicket {
  id: string;
  created_at: string;
  question: string;
  lang: Lang;
  context: string;
  status: 'open' | 'answered' | 'published';
  answer?: string;
  answered_at?: string;
  kb_id?: string;
}
