import React, { createContext, useContext, useState, useCallback } from 'react';

// ── Traductions inline (pour éviter une dépendance i18next) ──
import fr from '../i18n/fr.json';
import en from '../i18n/en.json';

const LOCALES = { fr, en };
export const SUPPORTED_LOCALES = ['fr', 'en'];

const LanguageContext = createContext(null);

function detectLocale() {
  const saved = localStorage.getItem('connectbe_locale');
  if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
  const browser = navigator.language?.split('-')[0];
  return SUPPORTED_LOCALES.includes(browser) ? browser : 'fr';
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);

  const t = useCallback((key, vars = {}) => {
    const messages = LOCALES[locale] || LOCALES.fr;
    let text = getNestedValue(messages, key) ?? getNestedValue(LOCALES.fr, key) ?? key;
    // Remplacement de variables : t('hello', { name: 'Paul' }) → "Bonjour Paul"
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    });
    return text;
  }, [locale]);

  const setLocale = useCallback((newLocale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    localStorage.setItem('connectbe_locale', newLocale);
    setLocaleState(newLocale);
  }, []);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, supportedLocales: SUPPORTED_LOCALES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage doit être utilisé dans LanguageProvider');
  return ctx;
};
