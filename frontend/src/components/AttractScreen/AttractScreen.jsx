import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useLanguage }  from '../../contexts/LanguageContext';
import { useTheme }     from '../../contexts/ThemeContext';
import styles           from './AttractScreen.module.css';

const ATTRACT_DELAY = 60_000;
const EVENTS = ['touchstart', 'touchmove', 'mousedown', 'keydown', 'scroll', 'wheel'];

export default function AttractScreen() {
  const [visible, setVisible]   = useState(false);
  const timerRef                = useRef(null);   // useRef — stable entre les renders
  const { t, locale }           = useLanguage();
  const { config }              = useTheme();
  const location                = useLocation();
  const { hotelSlug }           = useParams();
  // L'écran d'attraction s'affiche uniquement sur l'accueil du kiosque (/:slug)
  const isHome = location.pathname === `/${hotelSlug}` || location.pathname === `/${hotelSlug}/`;

  useEffect(() => {
    // Réinitialise et relance le timer
    const reset = () => {
      clearTimeout(timerRef.current);
      setVisible(false);
      timerRef.current = setTimeout(() => setVisible(true), ATTRACT_DELAY);
    };

    // Démarre uniquement si on est sur l'accueil
    if (isHome) {
      reset();
      EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    } else {
      // Sur une autre page : cache l'écran et stoppe le timer
      clearTimeout(timerRef.current);
      setVisible(false);
    }

    return () => {
      clearTimeout(timerRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [isHome]); // se re-exécute uniquement quand on change de page

  const dismiss = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
    // Redémarre le timer après dismiss
    timerRef.current = setTimeout(() => setVisible(true), ATTRACT_DELAY);
  };

  // Toujours dans le DOM — visibilité gérée par CSS (pas de return null)
  return (
    <div
      className={`${styles.overlay} ${visible && isHome ? styles.visible : ''}`}
      onClick={dismiss}
      onTouchStart={dismiss}
      role="button"
      aria-label={t('attract.dismiss')}
      aria-hidden={!visible}
    >
      <div className={styles.particles} aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className={styles.particle} style={{ '--i': i }} />
        ))}
      </div>

      <div className={styles.content}>
        <div className={styles.brand}>
          <p className={styles.hotelName}>{config?.hotel_name || 'ConnectBé'}</p>
          <p className={styles.tagline}>{t('attract.tagline')}</p>
        </div>

        <div className={styles.touchIconWrap} aria-hidden="true">
          <span className={`${styles.ring} ${styles.ring1}`} />
          <span className={`${styles.ring} ${styles.ring2}`} />
          <span className={`${styles.ring} ${styles.ring3}`} />
          <div className={styles.touchIcon}>
            <TouchFinger />
          </div>
        </div>

        <div className={styles.cta}>
          <p className={styles.ctaMain}>{t('attract.cta_main')}</p>
          <p className={styles.ctaSub}>{t('attract.cta_sub')}</p>
        </div>

        <Clock locale={locale} active={visible} />
      </div>
    </div>
  );
}

function TouchFinger() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="52" height="52">
      <path
        d="M32 4C28.7 4 26 6.7 26 10v22.4c-1.2-.8-2.6-1.4-4.2-1.4-3.3 0-6 2.7-6 6 0 1.8.8 3.4 2 4.6L26 49.8C27.8 56.2 33.6 60 40 60c7.7 0 14-6.3 14-14V28c0-3.3-2.7-6-6-6-1.2 0-2.3.3-3.2.9C44.3 21.6 43 19.9 41 19.2V10c0-3.3-2.7-6-6-6z"
        fill="currentColor" opacity="0.9"
      />
    </svg>
  );
}

function Clock({ locale, active }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    if (!active) return; // n'tick que quand l'écran est visible
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const loc = locale === 'fr' ? 'fr-BF' : 'en-US';
  return (
    <div className={styles.clock}>
      <span className={styles.clockTime}>
        {time.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className={styles.clockDate}>
        {time.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
    </div>
  );
}
