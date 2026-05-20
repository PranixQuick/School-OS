'use client';
// components/LanguageSelector.tsx
import { LANG_LABELS, SUPPORTED_LANGS, type Lang } from '@/lib/i18n';
import { useLang } from '@/lib/useLang';

interface Props {
  value?: Lang;
  onChange?: (lang: Lang) => void;
  compact?: boolean;
}

export default function LanguageSelector({ value, onChange, compact = false }: Props) {
  const { lang: hookLang, setLang: hookSetLang } = useLang();
  const current = value ?? hookLang;
  function handleChange(l: Lang) {
    if (onChange) onChange(l);
    else hookSetLang(l);
  }
  return (
    <select value={current} onChange={e => handleChange(e.target.value as Lang)}
      style={{ padding: compact ? '4px 8px' : '6px 12px', border: '1px solid #E5E7EB', borderRadius: 7, fontSize: compact ? 11 : 13, background: '#fff', color: '#374151', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
      title="Select language">
      {SUPPORTED_LANGS.map(l => (
        <option key={l} value={l}>{LANG_LABELS[l]}</option>
      ))}
    </select>
  );
}

export { useLang } from '@/lib/useLang';
