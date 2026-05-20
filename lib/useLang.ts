'use client';
// lib/useLang.ts
// Single-source-of-truth language hook for EdProSys.
// Every page/component that needs the current language imports this ONE hook.
// Eliminates duplicated useState+useEffect+localStorage+addEventListener patterns
// across every page. Language changes propagate instantly app-wide.
//
// Usage:
//   const { lang, setLang } = useLang();
//   <span>{T('students', lang)}</span>
//
// Safe to call in any 'use client' component.
// Hydration-safe: returns 'en' on server/first render, then syncs to localStorage.

import { useState, useEffect, useCallback } from 'react';
import { type Lang } from './i18n';

export const LANG_KEY = 'edprosys_lang';
export const LANG_EVENT = 'edprosys_lang_change';

// Validate that a string is a supported Lang value
const SUPPORTED: Lang[] = ['en', 'hi', 'te', 'ta', 'kn', 'mr', 'ml'];
function isLang(v: string | null): v is Lang {
  return !!v && (SUPPORTED as string[]).includes(v);
}

export function useLang(): { lang: Lang; setLang: (l: Lang) => void } {
  // Start with 'en' to avoid SSR/hydration mismatch.
  // After mount, sync from localStorage.
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    // Sync from storage on mount
    const stored = localStorage.getItem(LANG_KEY);
    if (isLang(stored)) setLangState(stored);

    // Listen for changes broadcast by the selector (or other tabs)
    function onLangChange() {
      const updated = localStorage.getItem(LANG_KEY);
      if (isLang(updated)) setLangState(updated);
    }
    window.addEventListener(LANG_EVENT, onLangChange);
    return () => window.removeEventListener(LANG_EVENT, onLangChange);
  }, []);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
    // Broadcast to all other components on this page
    window.dispatchEvent(new Event(LANG_EVENT));
  }, []);

  return { lang, setLang };
}
