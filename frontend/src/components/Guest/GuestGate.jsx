import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from './Guest.module.css';

// Longueur du code de séjour — doit rester alignée sur guestAccess.CODE_LENGTH
// côté serveur.
const CODE_LENGTH = 6;

/**
 * Écran de saisie du code de séjour, et écran de fin de séjour.
 *
 * Deux états, un seul composant : l'expiration n'est pas une erreur de saisie,
 * elle mérite un remerciement et un bouton pour repartir sur un nouveau code.
 *
 * Props :
 *  - onSubmit(code) : échange le code (le parent gère l'appel réseau)
 *  - loading        : requête en cours
 *  - reason         : cause d'échec renvoyée par l'API ('invalid', 'expired'…)
 *  - ended          : afficher l'écran « Séjour terminé »
 *  - onRestart      : revenir à la saisie depuis l'écran de fin
 *  - hotelName      : nom de l'établissement, affiché en en-tête
 */
export default function GuestGate({
  onSubmit,
  loading   = false,
  reason    = null,
  ended     = false,
  onRestart,
  hotelName,
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!ended) inputRef.current?.focus();
  }, [ended]);

  // Le clavier du téléphone envoie de la casse et parfois des tirets : on
  // normalise à la saisie pour que le champ montre exactement ce qui partira.
  function handleChange(e) {
    const cleaned = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setCode(cleaned.slice(0, CODE_LENGTH));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (code.length === CODE_LENGTH && !loading) onSubmit(code);
  }

  if (ended) {
    return (
      <div className={styles.gatePage}>
        <div className={styles.gateCard}>
          <span className={styles.gateIcon} aria-hidden="true">🌙</span>
          <h1 className={styles.gateTitle}>{t('guest.ended_title')}</h1>
          <p className={styles.gateText}>{t('guest.ended_thanks')}</p>
          <button type="button" className={styles.primaryBtn} onClick={onRestart}>
            {t('guest.ended_back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gatePage}>
      <form className={styles.gateCard} onSubmit={handleSubmit}>
        {hotelName && <p className={styles.gateHotel}>{hotelName}</p>}
        <h1 className={styles.gateTitle}>{t('guest.title')}</h1>
        <p className={styles.gateText}>{t('guest.intro')}</p>

        <label className={styles.gateLabel} htmlFor="guest-code">
          {t('guest.code_label')}
        </label>
        <input
          id="guest-code"
          ref={inputRef}
          className={styles.codeInput}
          value={code}
          onChange={handleChange}
          // Clavier majuscule sans correction automatique : un code n'est pas un mot.
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck="false"
          inputMode="text"
          enterKeyHint="go"
          placeholder="••••••"
          aria-describedby={reason ? 'guest-code-error' : undefined}
        />

        {reason && (
          <p id="guest-code-error" className={styles.gateError} role="alert">
            {t(`guest.error_${reason}`)}
          </p>
        )}

        <button
          type="submit"
          className={styles.primaryBtn}
          disabled={code.length !== CODE_LENGTH || loading}
        >
          {loading ? t('guest.checking') : t('guest.submit')}
        </button>
      </form>
    </div>
  );
}
