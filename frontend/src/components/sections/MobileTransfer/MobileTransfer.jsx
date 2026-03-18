import React, { useState, useEffect } from 'react';
import { QRCodeSVG }   from 'qrcode.react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useTheme }    from '../../../contexts/ThemeContext';
import { trackEvent }  from '../../../services/analytics';
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

const PUBLIC_URL = import.meta.env.VITE_KIOSK_PUBLIC_URL || 'http://localhost:3000';

export default function MobileTransfer() {
  const { t, locale }    = useLanguage();
  const { config }       = useTheme();
  const [active, setActive] = useState('weather');

  useEffect(() => { trackEvent('mobile', 'open'); }, []);

  const qrUrl = `${PUBLIC_URL}/mobile/${active}?lang=${locale}`;

  const handleSelect = (id) => {
    setActive(id);
    trackEvent('mobile', 'select_section', { section: id });
  };

  return (
    <div className={styles.page}>
      <BackButton />
      <LanguageSwitcher />

      <div className={styles.content}>
        {/* QR Code */}
        <div className={styles.qrBlock}>
          <div className={styles.qrFrame}>
            <QRCodeSVG
              value={qrUrl}
              size={260}
              fgColor={config.color_primary}
              bgColor="transparent"
              level="M"
              includeMargin={false}
            />
          </div>
          <p className={styles.scanInstruction}>{t('mobile.scan_instruction')}</p>
          <p className={styles.validFor}>{t('mobile.valid_for')}</p>
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

          <div className={styles.urlPreview}>
            <span className={styles.urlLabel}>URL :</span>
            <code className={styles.urlText}>{qrUrl}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
