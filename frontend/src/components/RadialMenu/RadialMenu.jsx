import React, { useState } from 'react';
import { useNavigate }      from 'react-router-dom';
import { useLanguage }      from '../../contexts/LanguageContext';
import { useTheme }         from '../../contexts/ThemeContext';
import { trackEvent }       from '../../services/analytics';
import LanguageSwitcher     from '../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle          from '../ThemeToggle/ThemeToggle';
import styles               from './RadialMenu.module.css';

const MENU_ITEMS = [
  { id: 'weather',  icon: '🌤️', route: '/weather',  labelKey: 'menu.weather',  color: '#F59E0B' },
  { id: 'flights',  icon: '✈️', route: '/flights',  labelKey: 'menu.flights',  color: '#3B82F6' },
  { id: 'map',      icon: '🗺️', route: '/map',      labelKey: 'menu.map',      color: '#10B981' },
  { id: 'events',   icon: '🗓️', route: '/events',   labelKey: 'menu.events',   color: '#EC4899' },
  { id: 'wellness', icon: '💆', route: '/wellness', labelKey: 'menu.wellness', color: '#8B5CF6' },
  { id: 'info',     icon: '📞', route: '/info',     labelKey: 'menu.info',     color: '#EF4444' },
  { id: 'mobile',   icon: '📱', route: '/mobile',   labelKey: 'menu.mobile',   color: '#6366F1' },
];

const RADIUS_VH = 32; // % de la hauteur de fenêtre

export default function RadialMenu() {
  const navigate          = useNavigate();
  const { t }             = useLanguage();
  const { config }        = useTheme();
  const [active, setActive] = useState(null);

  const handleSelect = (item) => {
    if (active) return;
    setActive(item.id);
    trackEvent(item.id, 'open');
    setTimeout(() => {
      navigate(item.route);
      setActive(null);
    }, 280);
  };

  return (
    <div className={styles.container} role="navigation" aria-label={t('menu.aria_label')}>
      {/* Contrôles haut */}
      <LanguageSwitcher />
      <ThemeToggle />

      {/* Hub central */}
      <div className={styles.hub} aria-hidden="true">
        <div className={styles.hubRing} />
        <div className={styles.hubContent}>
          <img
            src={config.logo_url || '/images/logo-placeholder.svg'}
            alt={config.hotel_name}
            className={styles.logo}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <p className={styles.hotelName}>{config.hotel_name}</p>
          <p className={styles.tagline}>{t('menu.tagline')}</p>
        </div>
      </div>

      {/* Items du menu positionnés en cercle */}
      {MENU_ITEMS.map((item, i) => {
        const angleDeg  = (i * 360) / MENU_ITEMS.length - 90;
        const angleRad  = (angleDeg * Math.PI) / 180;
        // Rayon adaptatif : vh sur grand écran, vw sur tablette
        const x = `calc(${Math.cos(angleRad) * RADIUS_VH}vh)`;
        const y = `calc(${Math.sin(angleRad) * RADIUS_VH}vh)`;

        return (
          <button
            key={item.id}
            className={`${styles.item} ${active === item.id ? styles.pressed : ''}`}
            style={{ '--x': x, '--y': y, '--color': item.color, '--delay': `${i * 70}ms` }}
            onClick={() => handleSelect(item)}
            aria-label={t(item.labelKey)}
          >
            {/* Anneau coloré */}
            <span className={styles.ring} aria-hidden="true" />
            {/* Glow au hover */}
            <span className={styles.glow} aria-hidden="true" />
            <span className={styles.icon} aria-hidden="true">{item.icon}</span>
            <span className={styles.label}>{t(item.labelKey)}</span>
          </button>
        );
      })}

      {/* Heure en bas */}
      <Clock />
    </div>
  );
}

function Clock() {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.clock} aria-live="off" aria-label={`Heure : ${time.toLocaleTimeString('fr-BF')}`}>
      <span className={styles.clockTime}>
        {time.toLocaleTimeString('fr-BF', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className={styles.clockDate}>
        {time.toLocaleDateString('fr-BF', { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
    </div>
  );
}
