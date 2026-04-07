import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useTheme }    from '../../../contexts/ThemeContext';
import { trackEvent }  from '../../../services/analytics';
import api             from '../../../services/api';
import BackButton      from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import styles          from './MobileTransfer.module.css';

const SECTIONS = [
  { id: 'weather',  icon: '🌤️', labelKey: 'mobile.sections.weather'  },
  { id: 'flights',  icon: '✈️', labelKey: 'mobile.sections.flights'  },
  { id: 'map',      icon: '🗺️', labelKey: 'mobile.sections.map'      },
  { id: 'wellness', icon: '💆', labelKey: 'mobile.sections.wellness' },
  { id: 'info',     icon: '📞', labelKey: 'mobile.sections.info'     },
];

// Seuil en secondes à partir duquel le token est auto-renouvelé
const REFRESH_THRESHOLD_SEC = 60;

export default function MobileTransfer() {
  const { t, locale }    = useLanguage();
  const { config }       = useTheme();
  const [active, setActive] = useState('weather');

  const [tokenData, setTokenData] = useState(null); // { token, expiresAt }
  const [timeLeft,  setTimeLeft]  = useState(null); // secondes restantes
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(false);

  const countdownRef = useRef(null);

  // ── Génère un nouveau token via l'API ──────────────────
  const fetchToken = useCallback(async (section, loc) => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.post('/qr/token', { section, locale: loc });
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

  useEffect(() => {
    fetchToken(active, locale);
  }, [active, locale, fetchToken]);

  // ── Countdown & auto-refresh ───────────────────────────
  useEffect(() => {
    if (!tokenData) return;

    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;

        // Auto-refresh quand il reste REFRESH_THRESHOLD_SEC secondes
        if (next === REFRESH_THRESHOLD_SEC) {
          fetchToken(active, locale);
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [tokenData, active, locale, fetchToken]);

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
      <BackButton />
      <LanguageSwitcher />

      <div className={styles.content}>
        {/* QR Code */}
        <div className={styles.qrBlock}>
          <div className={styles.qrFrame}>
            {loading || !qrUrl ? (
              <div className={styles.qrPlaceholder}>
                <div className="spinner" />
              </div>
            ) : error ? (
              <div className={styles.qrPlaceholder}>
                <p className={styles.errorText}>⚠️ {t('mobile.token_error')}</p>
                <button
                  className={styles.retryBtn}
                  onClick={() => fetchToken(active, locale)}
                >
                  {t('mobile.retry')}
                </button>
              </div>
            ) : (
              <QRCodeSVG
                value={qrUrl}
                size={260}
                fgColor={config.color_primary}
                bgColor="transparent"
                level="M"
                includeMargin={false}
              />
            )}
          </div>

          <p className={styles.scanInstruction}>{t('mobile.scan_instruction')}</p>

          {/* Countdown */}
          <div className={`${styles.countdown} ${isExpiringSoon ? styles.countdownWarning : ''}`}>
            <span className={styles.countdownIcon}>⏱</span>
            <span className={styles.countdownLabel}>{t('mobile.valid_for')}</span>
            <span className={styles.countdownTime}>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Choix de section */}
        <div className={styles.sectionPanel}>
          <h1 className={styles.title}>{t('mobile.title')}</h1>
          <p className={styles.subtitle}>{t('mobile.subtitle')}</p>

          <div className={styles.sectionGrid}>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                className={`${styles.sectionBtn} ${active === s.id ? styles.sectionActive : ''}`}
                onClick={() => handleSelect(s.id)}
                aria-pressed={active === s.id}
                aria-label={t(s.labelKey)}
              >
                <span className={styles.sectionIcon}>{s.icon}</span>
                <span className={styles.sectionLabel}>{t(s.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
