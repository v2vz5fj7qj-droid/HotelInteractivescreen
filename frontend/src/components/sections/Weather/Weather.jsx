import React, { useEffect, useState } from 'react';
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

function windDirection(deg) {
  const dirs = ['N','NE','E','SE','S','SO','O','NO'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatTime(ts, tz) {
  try {
    return new Date(ts * 1000).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit', timeZone: tz || 'Africa/Ouagadougou',
    });
  } catch { return '--:--'; }
}

const SEASON_FR = { rainy: 'Saison des pluies', harmattan: 'Harmattan', dry: 'Saison sèche' };
const SEASON_EN = { rainy: 'Rainy season',       harmattan: 'Harmattan',  dry: 'Dry season'   };

export default function Weather() {
  const { t, locale }      = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: localities } = useApi('/weather/localities');
  const locCount   = localities?.length ?? 1;
  const selectedId = localities?.[activeIndex]?.id ?? null;

  const { data, loading, offline } = useApi(
    '/weather/current',
    selectedId ? { locality_id: selectedId } : {},
    { deps: [selectedId] },
  );

  useEffect(() => { trackEvent('weather', 'open'); }, []);

  // Nom de la localité active (depuis la liste, toujours disponible)
  const activeLocality = localities?.[activeIndex];
  const tz = 'Africa/Ouagadougou';

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

      {/* ── Sélecteur de localité (boutons) ── */}
      {locCount > 1 && (
        <div className={styles.localitySelector}>
          {localities.map((loc, i) => (
            <button
              key={loc.id}
              className={`${styles.localityBtn} ${i === activeIndex ? styles.localityBtnActive : ''}`}
              onClick={() => setActiveIndex(i)}
              aria-current={i === activeIndex}
            >
              📍 {loc.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Nom de la localité — toujours affiché ── */}
      <div className={styles.cityRow}>
        <div className={styles.cityName}>
          <span className={styles.cityIcon}>📍</span>
          {activeLocality?.name ?? '…'}
          {activeLocality?.country ? `, ${activeLocality.country}` : ''}
        </div>
        {data?.current?.season && (() => {
          const seasonLabel = locale === 'fr'
            ? SEASON_FR[data.current.season.key]
            : SEASON_EN[data.current.season.key];
          return (
            <div className={styles.seasonBadge}>
              <span>{data.current.season.icon}</span>
              {seasonLabel}
            </div>
          );
        })()}
      </div>

      {/* ── Chargement / erreur ── */}
      {loading && <div className={styles.spinnerWrap}><div className="spinner" /></div>}
      {!loading && !data && (
        <p style={{ color: 'var(--c-accent)', fontSize: '1.2rem', textAlign: 'center' }}>
          ⚠️ {t('weather.error')}
        </p>
      )}

      {/* ── Contenu animé (change à chaque localité) ── */}
      {data && (
        <div key={activeIndex} className={styles.slideIn}>

          {/* ── Météo actuelle ── */}
          <section className={styles.current} aria-label={t('weather.current')}>
            <div className={styles.mainBlock}>
              <div className={styles.mainLeft}>
                <img
                  src={`https://openweathermap.org/img/wn/${data.current.icon}@4x.png`}
                  alt={data.current.description}
                  className={styles.mainIcon}
                />
              </div>
              <div className={styles.mainCenter}>
                <div className={styles.temp}>{data.current.temp}°<span className={styles.tempUnit}>C</span></div>
                <div className={styles.description}>{data.current.description}</div>
                <div className={styles.feelsLike}>{t('weather.feels_like')} {data.current.feels_like}°C</div>
                <div className={styles.tempRange}>
                  <span className={styles.tempMax}>↑ {data.current.temp_max}°</span>
                  <span className={styles.tempMin}>↓ {data.current.temp_min}°</span>
                </div>
              </div>
              <div className={styles.mainRight}>
                {data.current.uvi !== null && (
                  <div className={styles.uviCard} style={{ '--uvi-color': data.current.uvi_info?.color }}>
                    <span className={styles.uviLabel}>{t('weather.uvi')}</span>
                    <span className={styles.uviValue}>{data.current.uvi}</span>
                    <span className={styles.uviLevel}>{data.current.uvi_info?.level}</span>
                  </div>
                )}
                <div className={styles.sunTimes}>
                  <div className={styles.sunItem}>
                    <span>🌅</span>
                    <span>{formatTime(data.current.sunrise, tz)}</span>
                  </div>
                  <div className={styles.sunItem}>
                    <span>🌇</span>
                    <span>{formatTime(data.current.sunset, tz)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.metrics}>
              <Metric icon="💧" value={`${data.current.humidity}%`}       label={t('weather.humidity')} />
              <Metric icon="🌬️" value={`${data.current.wind_speed} km/h`} label={`${t('weather.wind')} ${windDirection(data.current.wind_deg)}`} />
              <Metric icon="👁️" value={`${data.current.visibility} km`}   label={t('weather.visibility')} />
              <Metric icon="🌡️" value={`${data.current.pressure} hPa`}    label={t('weather.pressure')} />
            </div>
          </section>

          {/* ── Prévisions horaires ── */}
          {data.hourly?.length > 0 && (
            <section className={styles.hourlySection} aria-label={t('weather.hourly')}>
              <h2 className={styles.sectionTitle}>{t('weather.hourly')}</h2>
              <div className={styles.hourlyRow}>
                {data.hourly.map((h, i) => {
                  const hh = new Date(h.dt * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
                  return (
                    <div key={i} className={styles.hourlyCard}>
                      <span className={styles.hourlyTime}>{hh}</span>
                      <img src={`https://openweathermap.org/img/wn/${h.icon}@2x.png`} alt="" className={styles.hourlyIcon} />
                      <span className={styles.hourlyTemp}>{h.temp}°</span>
                      {h.pop > 0 && <span className={styles.hourlyPop}>💧{h.pop}%</span>}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Alertes ── */}
          {data.alerts?.length > 0 && data.alerts.map((a, i) => (
            <div key={i} className={styles.alert} role="alert">
              <span>⚠️</span>
              <div>
                <strong>{t('weather.alert_title')} : {a.event}</strong>
                <p>{a.description}</p>
              </div>
            </div>
          ))}

          {/* ── Prévisions 5 jours ── */}
          <section className={styles.forecastSection} aria-label={t('weather.forecast_7days')}>
            <h2 className={styles.sectionTitle}>{t('weather.forecast_7days')}</h2>
            <div className={styles.forecastGrid}>
              {data.forecast.map((day, i) => {
                const dayName = (DAY_SHORT[locale] || DAY_SHORT.fr)[new Date(day.dt * 1000).getDay()];
                return (
                  <div key={i} className={styles.forecastCard}>
                    <span className={styles.dayLabel}>{dayName}</span>
                    <img src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`} alt={day.description} className={styles.forecastIcon} />
                    <div className={styles.temps}>
                      <span className={styles.maxT}>{day.temp_max}°</span>
                      <span className={styles.minT}>{day.temp_min}°</span>
                    </div>
                    <div className={styles.precip}>💧 {day.pop}%</div>
                    <div className={styles.forecastHumidity}>💦 {day.humidity}%</div>
                  </div>
                );
              })}
            </div>
          </section>

        </div>
      )}
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
