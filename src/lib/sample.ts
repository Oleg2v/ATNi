import type { Assessment } from '../types.ts';
import type { AppState } from '../store/initial.ts';
import { computeResult } from '../engine/score.ts';
import { activeVersionFor } from './data.ts';

/** Sample answers for the current (synthetic) company: Marketing lands on C; differs from the seeded September result so the history shows two distinct entries. */
export const SAMPLE_ANSWERS: Assessment['answers'] = {
  '1.1': { type: 'option', selected: 'Yes, in draft' },
  '1.2': { type: 'choices', selected: ['Reformulation targets (sugar, salt, fat)', 'Affordable healthier product lines'] },
  '1.3': { type: 'option', selected: 'Some products' },
  '1.4': { type: 'text', text: 'Reduced added sugar in our flagship porridge mix from 18 g to 9 g per 100 g (trial batch, 2026).' },
  '2.1': { type: 'option', selected: 'Yes' },
  '2.2': { type: 'option', selected: 'Under 13' },
  '2.3': { type: 'choices', selected: ['Television and radio', 'Packaging and in-store promotion'] },
  '2.4': { type: 'option', selected: 'No' },
  '3.1': { type: 'option', selected: 'Yes, at all sites' },
  '3.2': { type: 'choices', selected: ['Healthier food or snacks at work', 'Nutrition education for employees'] },
  '4.1': { type: 'option', selected: 'Yes, all products' },
  '4.2': { type: 'choices', selected: ['Clear allergen highlighting'] },
  '5.1': { type: 'option', selected: 'No' },
  '5.2': { type: 'choices', selected: ['Industry associations', 'Government ministries or agencies'] },
};

/**
 * Create a completed assessment for the current user from the sample answers,
 * on the version that is currently published for the profile country.
 * Returns the new state (pure; call inside update()).
 */
export function withSampleAssessment(s: AppState, nowIso: string): AppState {
  const profile = s.profile ?? { country: 'KE' as const, size: 'medium' as const, lang: s.lang, company_id: 'C-001' };
  const v = activeVersionFor(s, profile.country);
  const company = s.companies.find((c) => c.id === profile.company_id) ?? s.companies[0];
  const a: Assessment = {
    id: `L-${String(s.myAssessments.length + 1).padStart(3, '0')}`,
    company_id: company.id,
    company_name: company.name,
    country: profile.country,
    company_size: profile.size,
    lang: s.lang,
    version_id: v.id,
    started_at: nowIso,
    completed_at: nowIso,
    answers: SAMPLE_ANSWERS,
    result: computeResult(v, SAMPLE_ANSWERS, nowIso),
    consent_investor_share: s.investorConsent,
    plan_downloaded: false,
  };
  return { ...s, profile, draft: null, myAssessments: [...s.myAssessments, a] };
}

/** Latest completed assessment of the current user (local first, then the seeded one). */
export function latestOwnAssessment(s: AppState, seeded: Assessment[] | null): Assessment | null {
  const local = [...s.myAssessments].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0];
  if (local) return local;
  if (s.accountDeleted) return null;
  const mine = (seeded ?? []).filter((a) => a.company_id === 'C-001').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
  return mine[0] ?? null;
}
