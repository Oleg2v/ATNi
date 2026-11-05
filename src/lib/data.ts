import type { Assessment, CountryCode, Lang, MethodologyVersion, Question } from '../types.ts';
import type { AppState } from '../store/initial.ts';

let cache: Assessment[] | null = null;
let pending: Promise<Assessment[]> | null = null;

/** The 74 seeded synthetic assessments are loaded lazily (they are not needed for the first paint). */
export function loadSeedAssessments(): Promise<Assessment[]> {
  if (cache) return Promise.resolve(cache);
  if (!pending)
    pending = import('../data/assessments.json').then((m) => {
      cache = m.default as unknown as Assessment[];
      return cache;
    });
  return pending;
}

export function seedAssessmentsSync(): Assessment[] | null {
  return cache;
}

/** Published version that applies to a country: a country-specific one wins over the shared one. */
export function activeVersionFor(state: AppState, country: CountryCode | null | undefined): MethodologyVersion {
  const published = state.versions.filter((v) => v.status === 'published');
  const specific = country ? published.filter((v) => v.country === country) : [];
  const shared = published.filter((v) => v.country === '*');
  const pick = (list: MethodologyVersion[]) => [...list].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0];
  return pick(specific) ?? pick(shared) ?? state.versions[0];
}

export function versionById(state: AppState, id: string): MethodologyVersion | undefined {
  return state.versions.find((v) => v.id === id);
}

/* ---- localisation of methodology content ---- */

export function topicName(v: MethodologyVersion, topicId: string, lang: Lang): string {
  if (lang === 'sw') return v.translations.sw.topics?.[topicId] ?? topicId;
  return v.topics.find((t) => t.id === topicId)?.name ?? topicId;
}

export function qText(v: MethodologyVersion, q: Question, lang: Lang): { question: string; info: string; options: string[]; textPlaceholder: string; translated: boolean } {
  const p = q.propositions;
  const enOptions = p.type === 'option' ? p.propositions.map((o) => o.proposition) : p.type === 'choices' ? p.propositions : [];
  const enPlaceholder = p.type === 'text' ? p.proposition : '';
  if (lang === 'sw') {
    const t = v.translations.sw.questions?.[q.question_id];
    if (t?.question) {
      const opts = t.propositions && t.propositions.length === enOptions.length ? t.propositions : enOptions;
      return { question: t.question, info: t.info ?? q.info ?? '', options: opts, textPlaceholder: t.text_proposition ?? enPlaceholder, translated: true };
    }
  }
  return { question: q.question, info: q.info ?? '', options: enOptions, textPlaceholder: enPlaceholder, translated: lang === 'en' };
}

export function recText(v: MethodologyVersion, recId: string, en: string, lang: Lang): { text: string; translated: boolean } {
  if (lang === 'sw') {
    const sw = v.translations.sw.recommendations?.[recId];
    if (sw) return { text: sw, translated: true };
  }
  return { text: en, translated: lang === 'en' };
}

export function ruleTitle(v: MethodologyVersion, ruleId: string, en: string, lang: Lang): string {
  if (lang === 'sw') return v.translations.sw.roadmap_titles?.[ruleId] ?? en;
  return en;
}

export function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(lang === 'sw' ? 'sw-KE' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
}

export function fmtDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(lang === 'sw' ? 'sw-KE' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function downloadJson(name: string, data: unknown): void {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* ignore */
  }
}

export function downloadText(name: string, text: string, type = 'text/plain'): void {
  try {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    /* ignore */
  }
}
