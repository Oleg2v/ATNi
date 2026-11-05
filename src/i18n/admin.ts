/**
 * Strings for the administration area (src/pages/admin).
 * The admin interface stays English in this concept; the Swahili dictionary
 * translates the navigation and access messages only and keeps the same shape.
 */
import { useLang } from './index.tsx';

const en = {
  englishOnly: 'Admin interface: English only in this concept.',
  nav: {
    overview: 'Overview',
    methodology: 'Methodology',
    health: 'Health',
    import: 'Import',
    analytics: 'Analytics',
    tickets: 'Hand-off queue',
    audit: 'Journal',
    countries: 'Countries',
    translations: 'Translations',
    settings: 'Settings',
    users: 'Users & roles',
  },
  gate: {
    company: 'The administration area is for the programme team. Company users see their own assessment, results and roadmap only.',
    content: 'Content editors maintain texts, translations and the hand-off queue; this page belongs to the methodology, analyst or administrator roles.',
    methodology: 'Methodology editors maintain versions, health and imports; this page belongs to the analyst or administrator roles.',
    analyst: 'Analysts read aggregated data and the journal; they do not edit methodology content or settings.',
    methodologyEditNote: 'Your role can view this version. Scoring, dependencies and recommendations are edited by the methodology role; Swahili texts by content editors.',
    swOnly: 'Content editors can edit the Swahili texts of a draft; scoring fields are read-only for this role.',
  },
  overview: {
    title: 'Administration',
    lead: 'Methodology versions, health, hand-off queue, journal and platform settings. Everything on this page is stored in your browser only.',
    role: 'Your demo role',
    versions: 'Methodology versions',
    openTickets: 'Open hand-off tickets',
    assessments: 'Assessments (synthetic)',
    draftHealth: 'Draft health',
    quickLinks: 'Quick links',
    engagement: 'Engagement overview',
  },
  common: {
    open: 'Open',
    createDraft: 'Create draft from this version',
    compareWith: 'Compare with …',
    backToVersions: 'Back to versions',
    basedOn: 'Based on',
    created: 'Created',
    publishedAt: 'Published',
    publishedBy: 'Published by',
    comment: 'Comment',
    immutable: 'Published versions are immutable; create a draft to change.',
    archivedNote: 'Archived versions are kept for the journal and for results that still reference them.',
    notFound: 'This version does not exist on this device.',
    syntheticData: 'synthetic data',
    showAll: 'Show all',
    showFewer: 'Show fewer',
    none: 'None',
  },
};

const sw: typeof en = {
  ...en,
  englishOnly: 'Kiolesura cha usimamizi: Kiingereza pekee katika dhana hii.',
  nav: {
    overview: 'Muhtasari',
    methodology: 'Mbinu',
    health: 'Afya ya mbinu',
    import: 'Ingiza',
    analytics: 'Uchambuzi',
    tickets: 'Foleni ya maswali',
    audit: 'Jarida',
    countries: 'Nchi',
    translations: 'Tafsiri',
    settings: 'Mipangilio',
    users: 'Watumiaji na majukumu',
  },
  gate: {
    ...en.gate,
    company: 'Eneo la usimamizi ni la timu ya programu. Watumiaji wa kampuni huona tathmini, matokeo na ramani yao ya njia pekee.',
  },
};

export const adminStrings = { en, sw };
export type AdminStrings = typeof en;

export function useAdminT(): AdminStrings {
  const lang = useLang();
  return adminStrings[lang] ?? en;
}
