import { createContext, useContext } from 'react';
import type { Lang } from '../types.ts';
import { strings, type Strings } from './strings.ts';

export const LangContext = createContext<Lang>('en');

export function useLang(): Lang {
  return useContext(LangContext);
}

/** Typed access to the UI dictionary. Swahili falls back to English per key via the identical shape. */
export function useT(): Strings {
  const lang = useLang();
  return (strings[lang] as unknown as Strings) ?? strings.en;
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
