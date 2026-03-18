import React, { useEffect } from 'react';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { useApi }       from '../../../hooks/useApi';
import { trackEvent }   from '../../../services/analytics';
import BackButton       from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../../ThemeToggle/ThemeToggle';
import styles           from './Weather.module.css';

const DAY_SHORT = {
  fr: ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'],
  en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
};

export default function Weather() {
  const { t, locale }               = useLanguage();
  const { data, loading, error, offline } = useApi('/weather/current');

  useEffect(() => { trackEvent('weather', 'open'); }, []);

  if (loading) return <Loader />;
  if (error && !data) return <ErrorState t={t} />;

  const { current, forecast, alerts } = data;

  return (
    <div className={styles.page}>
      <BackButton />
      <LanguageSwitcher />
      <ThemeToggle />

      {offline && (
        <div className={styles.offlineTag} role="status">
          ⚡ {t('common.offline_banner')}
        </div>
      )}

      <h1 className={styles.pageTitle}>{t('weather.title')}</h1>

      {/* ── Météo actuelle ── */}
      <section className={styles.current} aria-label={t('weather.current')}>
        <div className={styles.mainBlock}>
          <img
            src={`https://openweathermap.org/img/wn/${current.icon}@4x.png`}
            alt={current.description}
            className={styles.mainIcon}
          />
          <div>
            <div className={styles.temp}>{Math.round(current.temp)}°C</div>
            <div className={styles.description}>{current.description}</div>
            <div className={styles.feelsLike}>
              {t('weather.feels_like')} : {Math.round(current.feels_like)}°C
            </div>
          </div>
        </div>

        <div className={styles.metrics}>
          <Metric icon="💧" value={`${current.humidity}%`}       label={t('weather.humidity')} />
          <Metric icon="🌬️" value={`${current.wind_speed} km/h`} label={t('weather.wind')} />
          <Metric icon="👁️" value={`${current.visibility} km`}   label={t('weather.visibility')} />
          <Metric icon="🌡️" value={`${current.pressure} hPa`}    label={t('weather.pressure')} />
        </div>
      </section>

      {/* ── Alertes ── */}
      {alerts?.length > 0 && alerts.map((a, i) => (
        <div key={i} className={styles.alert} role="alert">
          <span>⚠️</span>
          <div>
            <strong>{t('weather.alert_title')} : {a.event}</strong>
            <p>{a.description}</p>
          </div>
        </div>
      ))}

      {/* ── Prévisions 7 jours ── */}
      <section className={styles.forecastSection} aria-label={t('weather.forecast_7days')}>
        <h2 className={styles.sectionTitle}>{t('weather.forecast_7days')}</h2>
        <div className={styles.forecastGrid}>
          {forecast.map((day, i) => {
            const date    = new Date(day.dt * 1000);
            const dayName = i === 0
              ? t('weather.today')
              : (DAY_SHORT[locale] || DAY_SHORT.fr)[date.getDay()];

            return (
              <div key={i} className={`${styles.forecastCard} ${i === 0 ? styles.todayCard : ''}`}>
                <span className={styles.dayLabel}>{dayName}</span>
                <img
                  src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`}
                  alt={day.description}
                  className={styles.forecastIcon}
                />
                <div className={styles.temps}>
                  <span className={styles.maxT}>{Math.round(day.temp_max)}°</span>
                  <span className={styles.minT}>{Math.round(day.temp_min)}°</span>
                </div>
                <div className={styles.precip}>💧 {day.pop}%</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, value, label }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricIcon}>{icon}</span>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

function Loader() {
  return (
    <div className={styles.center}>
      <div className="spinner" />
    </div>
  );
}

function ErrorState({ t }) {
  return (
    <div className={styles.center}>
      <p style={{ color: 'var(--c-accent)', fontSize: '1.2rem' }}>
        ⚠️ {t('weather.error')}
      </p>
    </div>
  );
}
