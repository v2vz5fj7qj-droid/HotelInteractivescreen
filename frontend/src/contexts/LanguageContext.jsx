import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import localesMeta from '../i18n/locales.json';

// Fallback bundlé (pas de lazy-load pour le français)
import frMessages from '../i18n/fr.json';

// Auto-découverte Vite de tous les fichiers de locale
const localeModules = import.meta.glob('../i18n/[a-z][a-z].json');

export const SUPPORTED_LOCALES = Object.keys(localesMeta);

const LanguageContext = createContext(null);

// Cache en mémoire des traductions déjà chargées
const loadedMessages = { fr: frMessages };

async function loadMessages(locale) {
  if (loadedMessages[locale]) return loadedMessages[locale];
  const key = `../i18n/${locale}.json`;
  if (!localeModules[key]) return frMessages; // fallback
  const mod = await localeModules[key]();
  loadedMessages[locale] = mod.default ?? mod;
  return loadedMessages[locale];
}

function detectLocale() {
  const saved = localStorage.getItem('connectbe_locale');
  if (saved && SUPPORTED_LOCALES.includes(saved)) return saved;
  const browser = navigator.language?.split('-')[0];
  return SUPPORTED_LOCALES.includes(browser) ? browser : 'fr';
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function applyDirection(locale) {
  const dir = localesMeta[locale]?.dir ?? 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = locale;
}

export function LanguageProvider({ children }) {
  const [locale, setLocaleState] = useState(detectLocale);
  const [messages, setMessages] = useState(loadedMessages[detectLocale()] ?? frMessages);

  // Chargement initial si la locale par défaut n'est pas le français
  useEffect(() => {
    const initial = detectLocale();
    applyDirection(initial);
    if (initial !== 'fr') {
      loadMessages(initial).then(setMessages);
    }
  }, []);

  const t = useCallback((key, vars = {}) => {
    let text = getNestedValue(messages, key) ?? getNestedValue(frMessages, key) ?? key;
    Object.entries(vars).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    });
    return text;
  }, [messages]);

  const setLocale = useCallback(async (newLocale) => {
    if (!SUPPORTED_LOCALES.includes(newLocale)) return;
    const msgs = await loadMessages(newLocale);
    localStorage.setItem('connectbe_locale', newLocale);
    applyDirection(newLocale);
    setMessages(msgs);
    setLocaleState(newLocale);
  }, []);

  return (
    <LanguageContext.Provider value={{
      locale,
      setLocale,
      t,
      supportedLocales: SUPPORTED_LOCALES,
      localesMeta,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage doit être utilisé dans LanguageProvider');
  return ctx;
};
