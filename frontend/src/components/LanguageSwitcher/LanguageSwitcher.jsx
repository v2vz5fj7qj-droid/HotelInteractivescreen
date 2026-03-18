import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from './LanguageSwitcher.module.css';

const LOCALE_FLAGS = { fr: '🇫🇷', en: '🇬🇧' };
const LOCALE_NAMES = { fr: 'FR', en: 'EN' };

export default function LanguageSwitcher() {
  const { locale, setLocale, supportedLocales } = useLanguage();

  return (
    <div className={styles.switcher} role="group" aria-label="Langue / Language">
      {supportedLocales.map(loc => (
        <button
          key={loc}
          className={`${styles.btn} ${loc === locale ? styles.active : ''}`}
          onClick={() => setLocale(loc)}
          aria-pressed={loc === locale}
          aria-label={`Langue : ${LOCALE_NAMES[loc]}`}
        >
          <span aria-hidden="true">{LOCALE_FLAGS[loc]}</span>
          <span>{LOCALE_NAMES[loc]}</span>
        </button>
      ))}
    </div>
  );
}
