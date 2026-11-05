import v10 from '../data/methodology-v1.0.json';
import v11 from '../data/methodology-v1.1.json';
import countriesJson from '../data/countries.json';
import companiesJson from '../data/companies.json';
import kbJson from '../data/kb.json';
import type { Answers, AuditEntry, Company, CompanySize, CountryCode, CountryDef, HandoffTicket, KbDoc, Lang, MethodologyVersion, Role, Assessment } from '../types.ts';

export interface Profile {
  country: CountryCode;
  size: CompanySize;
  lang: Lang;
  company_id: string;
}

export interface DraftAssessment {
  id: string;
  version_id: string;
  started_at: string;
  answers: Answers;
  /** answers captured while "offline" and not yet synced */
  pending_sync: string[];
  updated_at: string;
}

export interface Settings {
  retention_years: number;
  consent_text_version: string;
  lite: boolean;
}

export interface AppState {
  schema: 1;
  lang: Lang;
  role: Role;
  profile: Profile | null;
  draft: DraftAssessment | null;
  /** assessments created in this browser (completed) */
  myAssessments: Assessment[];
  versions: MethodologyVersion[];
  countries: CountryDef[];
  companies: Company[];
  kb: KbDoc[];
  tickets: HandoffTicket[];
  ticketSeq: number;
  audit: AuditEntry[];
  offline: boolean;
  settings: Settings;
  investorConsent: boolean;
  accountDeleted: boolean;
  tourDone: boolean;
  /** guided tour: current step index, or null when not running */
  tour: number | null;
}

export function initialState(): AppState {
  return {
    schema: 1,
    lang: 'en',
    role: 'company',
    profile: null,
    draft: null,
    myAssessments: [],
    versions: [v10 as unknown as MethodologyVersion, v11 as unknown as MethodologyVersion],
    countries: countriesJson as CountryDef[],
    companies: companiesJson as Company[],
    kb: kbJson as KbDoc[],
    tickets: [
      { id: 'HQ-0001', created_at: '2026-10-28T09:12:00Z', question: 'Can two colleagues work on the same assessment at the same time?', lang: 'en', context: 'survey', status: 'open' },
    ],
    ticketSeq: 1,
    audit: [
      { id: 'AU-0001', at: '2026-03-02T10:30:00Z', actor_role: 'methodology', action: 'publish', target: 'v1.0', details: 'Initial published methodology (synthetic).' },
      { id: 'AU-0002', at: '2026-10-20T14:00:00Z', actor_role: 'methodology', action: 'create-draft', target: 'v1.1', details: 'Draft created from v1.0.' },
      { id: 'AU-0003', at: '2026-10-21T08:45:00Z', actor_role: 'methodology', action: 'edit', target: 'v1.1 · Q1.3', details: 'Reworded question text.' },
      { id: 'AU-0004', at: '2026-10-21T08:52:00Z', actor_role: 'content', action: 'edit', target: 'v1.1 · Q5.2', details: 'Added option "Consumer groups".' },
    ],
    offline: false,
    settings: { retention_years: 5, consent_text_version: '2026-03', lite: false },
    investorConsent: true,
    accountDeleted: false,
    tourDone: false,
    tour: null,
  };
}
