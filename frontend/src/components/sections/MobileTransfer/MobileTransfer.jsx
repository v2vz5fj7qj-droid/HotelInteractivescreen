import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  KeyRound, Smartphone, Clock,
  CloudSun, PlaneTakeoff, MapPin, Sparkles, Phone,
} from 'lucide-react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useTheme }    from '../../../contexts/ThemeContext';
import { useHotel }    from '../../../contexts/HotelContext';
import { trackEvent }  from '../../../services/analytics';
import api             from '../../../services/api';
import SectionChrome   from '../../SectionChrome/SectionChrome';
import GuestCodeQr     from '../../Guest/GuestCodeQr';
import styles          from './MobileTransfer.module.css';

// Rubriques transférables : celles que /mobile/:section sait ouvrir
// (voir SECTION_COMPONENTS dans MobileGate).
const SECTIONS = [
  { id: 'weather',  Icon: CloudSun,     labelKey: 'mobile.sections.weather'  },
  { id: 'flights',  Icon: PlaneTakeoff, labelKey: 'mobile.sections.flights'  },
  { id: 'map',      Icon: MapPin,       labelKey: 'mobile.sections.map'      },
  { id: 'wellness', Icon: Sparkles,     labelKey: 'mobile.sections.wellness' },
  { id: 'info',     Icon: Phone,        labelKey: 'mobile.sections.info'     },
];

// Seuil en secondes à partir duquel le token est auto-renouvelé
const REFRESH_THRESHOLD_SEC = 60;

export default function MobileTransfer() {
  const { t, locale }    = useLanguage();
  const { config }       = useTheme();
  const { hotel, isSectionEnabled } = useHotel();

  // Une rubrique désactivée pour cet hôtel n'est pas transférable : le
  // téléphone tomberait sur la même garde que la borne.
  // Mémoïsé : ce tableau est une dépendance des effets ci-dessous, et un
  // nouveau tableau à chaque rendu relancerait la génération de jeton en boucle.
  const sections = useMemo(
    () => SECTIONS.filter(s => isSectionEnabled(s.id)),
    [isSectionEnabled]
  );

  const [active, setActive] = useState(() => sections[0]?.id ?? 'weather');

  const [tokenData, setTokenData] = useState(null); // { token, expiresAt }
  const [timeLeft,  setTimeLeft]  = useState(null); // secondes restantes
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(false);

  const countdownRef = useRef(null);

  // ── Génère un nouveau token via l'API ──────────────────
  const fetchToken = useCallback(async (section, loc, hotelId) => {
    if (!hotelId) return;          // config hôtel pas encore chargée
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.post('/qr/token', { section, locale: loc, hotel_id: hotelId });
      setTokenData(data);
      setTimeLeft(Math.floor((new Date(data.expiresAt) - Date.now()) / 1000));
    } catch (err) {
      console.error('[QR token]', err.message);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Génère un token à l'ouverture et à chaque changement de section ou locale
  useEffect(() => {
    trackEvent('mobile', 'open');
  }, []);

  // La config hôtel arrive après le premier rendu : si la rubrique active vient
  // d'être exclue (section désactivée pour cet hôtel), on retombe sur la
  // première rubrique encore transférable plutôt que de demander un jeton pour
  // une rubrique que le téléphone refusera d'ouvrir.
  useEffect(() => {
    if (sections.length && !sections.some(s => s.id === active)) {
      setActive(sections[0].id);
    }
  }, [sections, active]);

  useEffect(() => {
    if (!sections.some(s => s.id === active)) return;
    fetchToken(active, locale, hotel?.id);
  }, [active, locale, hotel?.id, fetchToken, sections]);

  // ── Countdown & auto-refresh ───────────────────────────
  useEffect(() => {
    if (!tokenData) return;

    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;

        // Auto-refresh quand il reste REFRESH_THRESHOLD_SEC secondes
        if (next === REFRESH_THRESHOLD_SEC) {
          fetchToken(active, locale, hotel?.id);
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [tokenData, active, locale, hotel?.id, fetchToken]);

  // ── Changement de section ──────────────────────────────
  const handleSelect = (id) => {
    setActive(id);
    setTokenData(null); // efface l'ancien QR immédiatement
    trackEvent('mobile', 'select_section', { section: id });
  };

  // ── URL du QR ──────────────────────────────────────────
  const qrUrl = tokenData
    ? `${window.location.origin}/mobile/${active}?token=${tokenData.token}&lang=${locale}`
    : null;

  // ── Formatage du countdown ─────────────────────────────
  const formatTime = (sec) => {
    if (sec == null || sec < 0) return '--:--';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isExpiringSoon = timeLeft !== null && timeLeft <= REFRESH_THRESHOLD_SEC;

  return (
    <div className={styles.page}>
      <SectionChrome theme={false} />

      <header className={styles.intro}>
        <h1 className={styles.title}>{t('mobile.title')}</h1>
        <p className={styles.introText}>{t('mobile.intro')}</p>
      </header>

      {/* Deux voies, deux portées : le code de séjour ouvre tout le menu pour
          toute la durée du séjour ; le QR de rubrique n'ouvre qu'une rubrique,
          pour quelques minutes. La première est la plus utile au client : elle
          passe donc en premier, et reste visible sans défilement. */}
      <div className={styles.content}>

        {/* ── Voie 1 — le séjour ───────────────────────── */}
        <section className={`${styles.card} ${styles.stayCard}`} aria-labelledby="stay-heading">
          <div className={styles.cardHead}>
            <KeyRound size={22} className={styles.cardIcon} aria-hidden="true" />
            <span className={styles.eyebrow}>{t('mobile.stay_eyebrow')}</span>
            <span className={styles.badge}>{t('mobile.stay_badge')}</span>
          </div>
          <GuestCodeQr headingId="stay-heading" />
        </section>

        {/* ── Voie 2 — une seule rubrique ────────────────
            Masquée si l'hôtel n'a aucune rubrique transférable : il ne reste
            alors que l'accès au séjour, qui occupe toute la largeur. */}
        {sections.length > 0 && (
        <section className={`${styles.card} ${styles.quickCard}`} aria-labelledby="quick-heading">
          <div className={styles.cardHead}>
            <Smartphone size={20} className={styles.cardIconMuted} aria-hidden="true" />
            <span className={styles.eyebrow}>{t('mobile.quick_eyebrow')}</span>
          </div>
          <h2 id="quick-heading" className={styles.cardTitle}>{t('mobile.quick_title')}</h2>

          <div className={styles.quickBody}>
            <div className={styles.qrBlock}>
              <div className={styles.qrFrame}>
                {loading || !qrUrl ? (
                  <div className={styles.qrPlaceholder}>
                    <div className="spinner" />
                  </div>
                ) : error ? (
                  <div className={styles.qrPlaceholder}>
                    <p className={styles.errorText}>{t('mobile.token_error')}</p>
                    <button
                      type="button"
                      className={styles.retryBtn}
                      onClick={() => fetchToken(active, locale, hotel?.id)}
                    >
                      {t('mobile.retry')}
                    </button>
                  </div>
                ) : (
                  /* size = résolution de rendu ; la taille affichée est pilotée
                     en CSS (--qr-size) pour suivre la taille de la borne. */
                  <QRCodeSVG
                    value={qrUrl}
                    size={512}
                    className={styles.qrCode}
                    fgColor={config.color_primary}
                    bgColor="transparent"
                    level="M"
                    includeMargin={false}
                  />
                )}
              </div>

              <div className={`${styles.countdown} ${isExpiringSoon ? styles.countdownWarning : ''}`}>
                <Clock size={15} aria-hidden="true" />
                <span className={styles.countdownLabel}>{t('mobile.valid_for')}</span>
                <span className={styles.countdownTime}>{formatTime(timeLeft)}</span>
              </div>
            </div>

            <div className={styles.quickSide}>
              <p className={styles.subtitle}>{t('mobile.subtitle')}</p>

              <div className={styles.sectionGrid}>
                {sections.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`${styles.sectionBtn} ${active === s.id ? styles.sectionActive : ''}`}
                    onClick={() => handleSelect(s.id)}
                    aria-pressed={active === s.id}
                  >
                    <s.Icon size={22} className={styles.sectionIcon} aria-hidden="true" />
                    <span className={styles.sectionLabel}>{t(s.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        )}
      </div>

      <p className={styles.footNote}>{t('mobile.no_code_hint')}</p>
    </div>
  );
}
