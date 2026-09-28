import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLanguage }  from '../../contexts/LanguageContext';
import { useTheme }     from '../../contexts/ThemeContext';
import { useHotel }     from '../../contexts/HotelContext';
import {
  CloudSun, PlaneTakeoff, MapPin,
  Sparkles, CalendarDays, Phone, Smartphone,
} from 'lucide-react';
import { trackEvent }   from '../../services/analytics';
import styles from './AttractScreen.module.css';

const ATTRACT_DELAY = 45_000;
const BG_INTERVAL   = 5_000;
const EVENTS = [
  { type: 'touchstart', capture: false },
  { type: 'touchmove',  capture: true  },
  { type: 'wheel',      capture: true  },
  { type: 'mousedown',  capture: false },
  { type: 'keydown',    capture: false },
  { type: 'scroll',     capture: true  },
  { type: 'click',      capture: false },
];

/* Images des sections du kiosque — donnent envie d'explorer */
const BG_SLIDES = [
  'https://images.unsplash.com/photo-1604938814491-c696899ec59b?auto=format&fit=crop&w=1400&q=70', // wellness
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1400&q=70', // flights
  'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1400&q=70', // events
  'https://images.unsplash.com/photo-1569144157591-c60f3f82f137?auto=format&fit=crop&w=1400&q=70', // map
];

/* Sections affichées dans la bande défilante — chaque puce ouvre sa section */
const TEASER_ITEMS = [
  { section: 'weather',  Icon: CloudSun,     labelKey: 'menu.weather'  },
  { section: 'flights',  Icon: PlaneTakeoff, labelKey: 'menu.flights'  },
  { section: 'wellness', Icon: Sparkles,     labelKey: 'menu.wellness' },
  { section: 'events',   Icon: CalendarDays, labelKey: 'menu.events'   },
  { section: 'map',      Icon: MapPin,       labelKey: 'menu.map'      },
  { section: 'info',     Icon: Phone,        labelKey: 'menu.info'     },
  { section: 'mobile',   Icon: Smartphone,   labelKey: 'menu.mobile'   },
];

export default function AttractScreen() {
  const [visible, setVisible] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const timerRef   = useRef(null);
  const bgTimerRef = useRef(null);
  const openingRef = useRef(false);
  const { t, locale }  = useLanguage();
  const { config }     = useTheme();
  const { isSectionEnabled } = useHotel();

  // Ne teaser que les sections activées pour cet hôtel (super-admin)
  const teaserItems = TEASER_ITEMS.filter(item => isSectionEnabled(item.section));
  const location       = useLocation();
  const navigate       = useNavigate();
  const { hotelSlug }  = useParams();

  const isHome = location.pathname === `/${hotelSlug}` || location.pathname === `/${hotelSlug}/`;

  useEffect(() => {
    const reset = () => {
      clearTimeout(timerRef.current);
      setVisible(false);
      timerRef.current = setTimeout(() => setVisible(true), ATTRACT_DELAY);
    };

    if (isHome) {
      reset();
      EVENTS.forEach(({ type, capture }) =>
        window.addEventListener(type, reset, { passive: true, capture })
      );
    } else {
      clearTimeout(timerRef.current);
      setVisible(false);
    }

    return () => {
      clearTimeout(timerRef.current);
      EVENTS.forEach(({ type, capture }) =>
        window.removeEventListener(type, reset, { capture })
      );
    };
  }, [isHome]);

  /* Nouveau visiteur détecté : l'attract screen s'affiche → reset session feedback */
  useEffect(() => {
    if (visible) sessionStorage.removeItem('feedback_submitted');
  }, [visible]);

  /* Cycle des images de fond — uniquement quand l'écran est visible */
  useEffect(() => {
    if (!visible) return;
    bgTimerRef.current = setInterval(
      () => setBgIndex(i => (i + 1) % BG_SLIDES.length),
      BG_INTERVAL,
    );
    return () => clearInterval(bgTimerRef.current);
  }, [visible]);

  const dismiss = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
    timerRef.current = setTimeout(() => setVisible(true), ATTRACT_DELAY);
  };

  /* Puce de la bande défilante : déverrouille l'écran et ouvre la section.
     pointerdown plutôt que click — le dismiss de l'overlay coupe le clic tactile. */
  const openSection = (section, e) => {
    e.stopPropagation();
    if (openingRef.current) return;   // pointerdown + click sur un même appui
    openingRef.current = true;
    dismiss();
    trackEvent(section, 'open', { from: 'attract' });
    navigate(`/${hotelSlug}/${section}`);
  };

  /* Réarmé à chaque réapparition de l'écran */
  useEffect(() => {
    if (visible) openingRef.current = false;
  }, [visible]);

  return (
    <div
      className={`${styles.overlay} ${visible && isHome ? styles.visible : ''}`}
      onClick={dismiss}
      onTouchStart={dismiss}
      role="button"
      aria-label={t('attract.dismiss')}
      aria-hidden={!visible}
    >
      {/* ── Fond slideshow : images des sections du kiosque ── */}
      <div className={styles.bgSlideshow} aria-hidden="true">
        {BG_SLIDES.map((src, i) => (
          <div
            key={src}
            className={`${styles.bgSlide} ${i === bgIndex ? styles.bgSlideActive : ''}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
      </div>

      {/* ── Vignette : sombre aux bords, laisse voir le fond au centre ── */}
      <div className={styles.vignette} aria-hidden="true" />

      {/* ── Particules flottantes ── */}
      <div className={styles.particles} aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className={styles.particle} style={{ '--i': i }} />
        ))}
      </div>

      {/* ── Contenu central (carte frosted-glass) ── */}
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

      {/* ── Bande défilante : raccourcis vers les sections ── */}
      <nav className={styles.teaser} aria-label={t('menu.aria_label')}>
        <div className={styles.teaserTrack}>
          {/* Doublé pour le défilement infini seamless — la copie est masquée aux lecteurs d'écran */}
          {[...teaserItems, ...teaserItems].map((item, i) => (
            <button
              key={i}
              type="button"
              className={styles.teaserChip}
              onPointerDown={e => openSection(item.section, e)}
              onClick={e => openSection(item.section, e)}
              tabIndex={visible && i < teaserItems.length ? 0 : -1}
              aria-hidden={i >= teaserItems.length ? 'true' : undefined}
            >
              <item.Icon size={18} />
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </div>
      </nav>
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
    if (!active) return;
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
