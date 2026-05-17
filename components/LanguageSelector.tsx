'use client';
// components/LanguageSelector.tsx
// Compact language selector — stores preference in localStorage
// Used in Layout header and stakeholder portals
import { useState, useEffect } from 'react';
import { LANG_LABELS, SUPPORTED_LANGS, type Lang } from '@/lib/i18n';

interface Props {
  value: Lang;
  onChange: (lang: Lang) => void;
  compact?: boolean;
}

export default function LanguageSelector({ value, onChange, compact = false }: Props) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as Lang)}
      style={{
        padding: compact ? '4px 8px' : '6px 12px',
        border: '1px solid #E5E7EB',
        borderRadius: 7,
        fontSize: compact ? 11 : 13,
        background: '#fff',
        color: '#374151',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: 600,
      }}
      title="Select language"
    >
      {SUPPORTED_LANGS.map(l => (
        <option key={l} value={l}>{LANG_LABELS[l]}</option>
      ))}
    </select>
  );
}

// Hook to persist language preference
export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => {
    const saved = (typeof window !== 'undefined' ? localStorage.getItem('edprosys_lang') : null) as Lang | null;
    if (saved && SUPPORTED_LANGS.includes(saved)) setLang(saved);
  }, []);
  function setAndSave(l: Lang) {
    setLang(l);
    if (typeof window !== 'undefined') localStorage.setItem('edprosys_lang', l);
  }
  return [lang, setAndSave];
}
