import { useEffect, useState } from 'react';
import type { Assessment } from '../types.ts';
import { loadSeedAssessments, seedAssessmentsSync } from './data.ts';
import { useStore } from '../store/index.tsx';

/** Seeded synthetic assessments + the ones completed in this browser. */
export function useAssessments(): { all: Assessment[]; loading: boolean } {
  const { state } = useStore();
  const [seed, setSeed] = useState<Assessment[] | null>(seedAssessmentsSync());
  useEffect(() => {
    let alive = true;
    if (!seed) loadSeedAssessments().then((d) => alive && setSeed(d));
    return () => {
      alive = false;
    };
  }, [seed]);
  const base = seed ?? [];
  const all = state.accountDeleted
    ? base.filter((a) => a.company_id !== 'C-001')
    : base.map((a) => (a.company_id === 'C-001' && a.consent_investor_share !== state.investorConsent ? { ...a, consent_investor_share: state.investorConsent } : a));
  return { all: [...all, ...state.myAssessments], loading: !seed };
}
