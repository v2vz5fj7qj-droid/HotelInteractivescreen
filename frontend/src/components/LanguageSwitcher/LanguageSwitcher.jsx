import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from './LanguageSwitcher.module.css';

export default function LanguageSwitcher() {
  const { locale, setLocale, supportedLocales, localesMeta } = useLanguage();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  function handleSelect(loc) {
    setLocale(loc);
    setOpen(false);
  }

  const currentMeta = localesMeta[locale];

  return (
    <div className={styles.wrapper} ref={containerRef}>
      {/* Bouton déclencheur */}
      <button
        className={styles.trigger}
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Changer de langue"
      >
        <span className={styles.triggerFlag} aria-hidden="true">{currentMeta?.flag}</span>
        <span className={styles.triggerCode}>{locale.toUpperCase()}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true">▾</span>
      </button>

      {/* Grille de langues */}
      {open && (
        <div className={styles.dropdown} role="listbox" aria-label="Sélectionner une langue">
          {supportedLocales.map(loc => {
            const meta = localesMeta[loc];
            const isActive = loc === locale;
            return (
              <button
                key={loc}
                role="option"
                aria-selected={isActive}
                className={`${styles.option} ${isActive ? styles.optionActive : ''}`}
                onClick={() => handleSelect(loc)}
              >
                <span className={styles.optionFlag} aria-hidden="true">{meta?.flag}</span>
                <span className={styles.optionName}>{meta?.nativeName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
