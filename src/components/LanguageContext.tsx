import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type AppLanguage = { code: string; name: string; nativeName: string };

export const DEFAULT_LANGUAGES: AppLanguage[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog' },
];

type LanguageContextType = {
  language: AppLanguage;
  languages: AppLanguage[];
  setLanguage: (language: AppLanguage) => void;
  addLanguage: (name: string) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
const STORAGE_KEY = 'reqvoice_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [languages, setLanguages] = useState<AppLanguage[]>(() => {
    try {
      const custom = JSON.parse(localStorage.getItem('reqvoice_custom_languages') || '[]');
      return [...DEFAULT_LANGUAGES, ...(Array.isArray(custom) ? custom : [])];
    } catch { return DEFAULT_LANGUAGES; }
  });
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.code && saved?.name) return saved;
    } catch {}
    return DEFAULT_LANGUAGES[0];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(language));
      localStorage.setItem('reqvoice_custom_languages', JSON.stringify(
        languages.filter(x => !DEFAULT_LANGUAGES.some(d => d.code === x.code))
      ));
      window.dispatchEvent(new CustomEvent('reqvoice-language-changed', { detail: language }));
    } catch {}
  }, [language, languages]);

  const setLanguage = (next: AppLanguage) => setLanguageState(next);
  const addLanguage = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const code = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32) || 'custom';
    const next = { code, name: clean, nativeName: clean };
    setLanguages(prev => prev.some(x => x.code === code) ? prev : [...prev, next]);
    setLanguageState(next);
  };

  const value = useMemo(() => ({ language, languages, setLanguage, addLanguage }), [language, languages]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used within LanguageProvider');
  return value;
};
