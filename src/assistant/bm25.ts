/** Minimal BM25 index over small document sets (runs in the browser, EN and SW tokens alike). */
export interface IndexedDoc {
  id: string;
  fields: string[];
}

export interface Bm25Index {
  docs: IndexedDoc[];
  tf: Map<string, number>[];
  df: Map<string, number>;
  len: number[];
  avgLen: number;
}

const STOP = new Set(['from', 'when', 'which', 'who', 'where', 'about', 'into', 'than', 'then', 'there', 'their', 'have', 'has', 'had', 'will', 'would', 'should', 'could', 'not', 'but', 'if', 'so', 'any', 'all', 'one', 'two', 'get', 'got', 'did', 'does', 'after', 'before', 'still', 'also', 'yes', 'no','the', 'a', 'an', 'is', 'are', 'to', 'of', 'in', 'on', 'for', 'and', 'or', 'my', 'i', 'it', 'do', 'does', 'what', 'why', 'how', 'can', 'be', 'with', 'this', 'that', 'was', 'at', 'as', 'by', 'me', 'we', 'you', 'your', 'ya', 'wa', 'na', 'ni', 'kwa', 'je', 'za', 'la', 'cha']);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

/** light suffix stripping for English plurals/-ing/-ed; Swahili left as-is */
function stem(t: string): string {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
  return t;
}

export function buildIndex(docs: IndexedDoc[]): Bm25Index {
  const tf: Map<string, number>[] = [];
  const df = new Map<string, number>();
  const len: number[] = [];
  for (const d of docs) {
    const terms = tokenize(d.fields.join(' '));
    const m = new Map<string, number>();
    for (const t of terms) m.set(t, (m.get(t) ?? 0) + 1);
    for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    tf.push(m);
    len.push(terms.length);
  }
  const avgLen = len.reduce((a, b) => a + b, 0) / Math.max(1, len.length);
  return { docs, tf, df, len, avgLen };
}

export interface Hit {
  id: string;
  score: number;
  matched: string[];
}

export function search(index: Bm25Index, query: string, k = 5, k1 = 1.4, b = 0.75): Hit[] {
  const qTerms = [...new Set(tokenize(query))];
  const N = index.docs.length;
  const hits: Hit[] = [];
  index.docs.forEach((d, i) => {
    let s = 0;
    const matched: string[] = [];
    for (const t of qTerms) {
      const f = index.tf[i].get(t);
      if (!f) continue;
      const n = index.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * index.len[i]) / index.avgLen)));
      matched.push(t);
    }
    if (s > 0) hits.push({ id: d.id, score: Math.round(s * 1000) / 1000, matched });
  });
  return hits.sort((a, b2) => b2.score - a.score).slice(0, k);
}
