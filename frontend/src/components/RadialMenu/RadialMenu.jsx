import React, { useState, useEffect, useRef } from 'react';
import { useNavigate }   from 'react-router-dom';
import { useLanguage }   from '../../contexts/LanguageContext';
import { useTheme }      from '../../contexts/ThemeContext';
import { trackEvent }    from '../../services/analytics';
import api               from '../../services/api';
import {
  Hotel, Search, Mic,
  CloudSun, PlaneTakeoff, MapPin,
  Sparkles, CalendarDays, Phone,
  Smartphone, Home, Bell, ChevronRight,
  Languages,
} from 'lucide-react';
import styles from './RadialMenu.module.css';

/* ─── Configuration des sections ──────────────────────── */
const NAV_ITEMS = [
  { id: 'mobile',   Icon: Smartphone,    route: '/mobile',   labelKey: 'menu.mobile'   },
  { id: 'flights',  Icon: PlaneTakeoff,  route: '/flights',  labelKey: 'menu.flights'  },
  { id: 'wellness', Icon: Sparkles,      route: '/wellness', labelKey: 'menu.wellness' },
  { id: 'events',   Icon: CalendarDays,  route: '/events',   labelKey: 'menu.events'   },
  { id: 'map',      Icon: MapPin,        route: '/map',      labelKey: 'menu.map'      },
  { id: 'info',     Icon: Phone,         route: '/info',     labelKey: 'menu.info'     },
];

/* Cards de service dans la grille (4 cartes principales) */
const SERVICE_CARDS = [
  {
    id: 'wellness',
    route: '/wellness',
    labelKey: 'menu.wellness',
    subKey:   'menu.wellness_sub',
    Icon:  Sparkles,
    color: '#8B5CF6',
    img:   'https://images.unsplash.com/photo-1604938814491-c696899ec59b?auto=format&fit=crop&w=400&q=70',
  },
  {
    id: 'flights',
    route: '/flights',
    labelKey: 'menu.flights',
    subKey:   'menu.flights_sub',
    Icon:  PlaneTakeoff,
    color: '#C2782A',
    img:   'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=400&q=70',
  },
  {
    id: 'events',
    route: '/events',
    labelKey: 'menu.events',
    subKey:   'menu.events_sub',
    Icon:  CalendarDays,
    color: '#D4A843',
    img:   'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=400&q=70',
  },
  {
    id: 'map',
    route: '/map',
    labelKey: 'menu.map',
    subKey:   'menu.map_sub',
    Icon:  MapPin,
    color: '#10B981',
    img:   'https://images.unsplash.com/photo-1569144157591-c60f3f82f137?auto=format&fit=crop&w=400&q=70',
  },
];

/* ─── Composant principal ──────────────────────────────── */
export default function RadialMenu() {
  const navigate          = useNavigate();
  const { t, locale, setLocale, supportedLocales, localesMeta } = useLanguage();
  const { config }        = useTheme();
  const [activeNav,    setActiveNav]    = useState(null);
  const [notifIndex,   setNotifIndex]   = useState(0);
  const [notifs,       setNotifs]       = useState([]);
  const [localities,   setLocalities]   = useState([]);
  const [weatherIndex, setWeatherIndex] = useState(0);
  const [liveWeather,  setLiveWeather]  = useState(null);
  const [langOpen,     setLangOpen]     = useState(false);
  const langRef        = useRef(null);
  const weatherTimer   = useRef(null);
  const wTouchStart    = useRef(null);
  const didSwipe       = useRef(false);

  // Défilement vertical du texte "Bon à savoir"
  const clipRef        = useRef(null);
  const msgRef         = useRef(null);
  const [scrollDist,   setScrollDist]   = useState(0);
  const [scrollDuration, setScrollDuration] = useState(4);

  // ── Raccourci admin caché : 5 taps rapides sur le logo ──
  const tapCount  = useRef(0);
  const tapTimer  = useRef(null);
  const handleLogoTap = () => {
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      navigate('/admin');
      return;
    }
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
  };

  // Charger les notifications depuis l'API
  useEffect(() => {
    api.get('/notifications').then(r => {
      if (r.data?.length) setNotifs(r.data);
    }).catch(() => {});
  }, []);

  // Charger la liste des localités
  useEffect(() => {
    api.get('/weather/localities').then(r => {
      if (r.data?.length) setLocalities(r.data);
    }).catch(() => {});
  }, []);

  // Fetch météo pour la localité active
  useEffect(() => {
    const loc = localities[weatherIndex];
    const params = loc ? { locality_id: loc.id } : {};
    api.get('/weather/current', { params }).then(r => {
      if (r.data?.current) setLiveWeather(r.data.current);
    }).catch(() => {});
  }, [weatherIndex, localities]);

  // Auto-rotation météo toutes les 8s (un seul interval, ne se reset pas)
  useEffect(() => {
    if (localities.length <= 1) return;
    weatherTimer.current = setInterval(
      () => setWeatherIndex(i => (i + 1) % localities.length),
      8000,
    );
    return () => clearInterval(weatherTimer.current);
  }, [localities.length]); // ← pas weatherIndex : l'interval tourne librement

  // Fermer le sélecteur de langue au clic extérieur
  useEffect(() => {
    function handleOutside(e) {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
    }
    if (langOpen) document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [langOpen]);

  // Rotation automatique des notifications toutes les 6s
  useEffect(() => {
    if (notifs.length <= 1) return;
    const id = setInterval(() => setNotifIndex(i => (i + 1) % notifs.length), 5000);
    return () => clearInterval(id);
  }, [notifs.length]);

  // Calcul du défilement : distance = hauteur texte − hauteur clip
  useEffect(() => {
    const id = setTimeout(() => {
      if (!clipRef.current || !msgRef.current) return;
      const dist = Math.max(0, msgRef.current.scrollHeight - clipRef.current.offsetHeight);
      setScrollDist(dist);
      // Vitesse : ~28px/s, minimum 3s, maximum 10s
      setScrollDuration(dist > 0 ? Math.min(10, Math.max(3, dist / 28)) : 4);
    }, 80); // laisser le DOM se stabiliser après changement de notifIndex
    return () => clearTimeout(id);
  }, [notifIndex, notifs]);

  const currentNotif = notifs[notifIndex];
  const notifMsg = currentNotif
    ? (locale !== 'fr' && currentNotif.message_en ? currentNotif.message_en : currentNotif.message_fr)
    : t('menu.notif_msg');

  const go = (id, route) => {
    if (activeNav) return;
    setActiveNav(id);
    trackEvent(id, 'open');
    setTimeout(() => { navigate(route); setActiveNav(null); }, 280);
  };

  return (
    <div className={styles.shell} role="main">

      {/* ══ HEADER ══════════════════════════════════════ */}
      <header className={styles.header}>
        {/* Logo + nom */}
        <div className={styles.brand}>
          <div
            className={styles.brandIcon}
            onClick={handleLogoTap}
            aria-hidden="true"
            style={{ cursor: 'default' }}
          >
            <Hotel size={36} />
          </div>
          <div>
            <h1 className={styles.brandName}>{config.hotel_name || 'ConnectBé'}</h1>
            <Clock locale={locale} />
          </div>
        </div>

        {/* Barre de recherche */}
        <div className={styles.searchWrap}>
          <Search size={22} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            placeholder={t('menu.search_placeholder')}
            className={styles.searchInput}
            aria-label={t('menu.search_placeholder')}
            readOnly
            onFocus={e => e.target.blur()} /* kiosque — placeholder visuel */
          />
          <button className={styles.micBtn} aria-label="Recherche vocale">
            <Mic size={20} />
          </button>
        </div>
      </header>

      {/* ══ GRILLE PRINCIPALE ═══════════════════════════ */}
      <div className={styles.grid}>

        {/* A — Bannière immersive */}
        <section className={styles.banner} aria-label={t('menu.welcome')}>
          <img
            src={config?.banner_image_url || 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=80'}
            alt={t('menu.welcome')}
            className={styles.bannerImg}
          />
          <div className={styles.bannerOverlay} />
          <div className={styles.bannerContent}>
            <div>
              <span className={styles.bannerBadge}>{t('menu.live_badge')}</span>
              <h2 className={styles.bannerTitle}>
                {t('menu.banner_line1')}<br />
                {t('menu.banner_line2')} <span className={styles.bannerAccent}>{t('menu.banner_accent')}</span>
              </h2>
            </div>
            {/* Widget météo rapide dans la bannière */}
            <div className={styles.bannerWeatherCard} onClick={() => go('weather', '/weather')}>
              <CloudSun size={28} className={styles.bannerWeatherIcon} />
              <div>
                <p className={styles.bannerWeatherLabel}>{t('menu.weather')}</p>
                <p className={styles.bannerWeatherTemp}>Ouagadougou</p>
              </div>
              <ChevronRight size={20} className={styles.bannerChevron} />
            </div>
          </div>
        </section>

        {/* B — Cartes de services */}
        <section className={styles.serviceCol} aria-label={t('menu.services')}>
          {SERVICE_CARDS.map(card => (
            <ServiceCard
              key={card.id}
              card={card}
              label={t(card.labelKey)}
              sub={t(card.subKey)}
              active={activeNav === card.id}
              onPress={() => go(card.id, card.route)}
            />
          ))}
        </section>

        {/* C — Notification */}
        <div className={styles.notifCard}>
          <div className={styles.notifLeft}>
            <div className={styles.notifBellWrap}>
              <Bell size={32} className={styles.notifBell} />
              {notifs.length > 0 && <span className={styles.notifDot} aria-hidden="true" />}
            </div>
            <div className={styles.notifTextWrap}>
              <p className={styles.notifTitle}>{t('menu.notif_title')}</p>
              <div className={styles.notifMsgClip} ref={clipRef}>
                <p
                  key={notifIndex}
                  ref={msgRef}
                  className={`${styles.notifMsg} ${scrollDist > 0 ? styles.notifMsgScrolling : ''}`}
                  style={scrollDist > 0 ? {
                    '--notif-scroll':          `-${scrollDist}px`,
                    '--notif-scroll-duration': `${scrollDuration}s`,
                  } : undefined}
                >
                  {notifMsg}
                </p>
              </div>
              {notifs.length > 1 && (
                <div className={styles.notifDots} aria-hidden="true">
                  {notifs.map((_, i) => (
                    <span
                      key={i}
                      className={`${styles.notifDotBar} ${i === notifIndex ? styles.notifDotBarActive : ''}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          {notifs.length > 1 && (
            <div className={styles.notifProgressWrap}>
              <div key={notifIndex} className={styles.notifProgressBar} />
            </div>
          )}
        </div>

        {/* D — Widget météo (swipeable) */}
        <div
          className={styles.weatherCard}
          role="button"
          aria-label={t('menu.weather')}
          onClick={() => { if (!didSwipe.current) go('weather', '/weather'); }}
          onTouchStart={(e) => {
            didSwipe.current = false;
            wTouchStart.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (wTouchStart.current === null) return;
            const dx = e.changedTouches[0].clientX - wTouchStart.current;
            wTouchStart.current = null;
            if (Math.abs(dx) < 50 || localities.length <= 1) return;
            didSwipe.current = true;
            clearInterval(weatherTimer.current);
            setWeatherIndex(i => dx < 0
              ? (i + 1) % localities.length
              : (i - 1 + localities.length) % localities.length
            );
          }}
        >
          <div className={styles.weatherCardBody}>
            <p className={styles.weatherCardLabel}>
              {localities[weatherIndex]?.name || t('menu.weather_widget_label')}
            </p>
            <p className={styles.weatherCardTemp}>
              {liveWeather ? `${liveWeather.temp}°C` : '--°C'}
            </p>
            <p className={styles.weatherCardDesc}>
              {liveWeather ? liveWeather.description : t('menu.weather_widget_desc')}
            </p>
          </div>
          {liveWeather?.icon
            ? <img src={`https://openweathermap.org/img/wn/${liveWeather.icon}@2x.png`} alt="" style={{ width: 64, height: 64 }} />
            : <CloudSun size={64} className={styles.weatherCardIcon} />
          }
          {localities.length > 1 && (
            <div className={styles.weatherDots}>
              {localities.map((_, i) => (
                <span
                  key={i}
                  className={`${styles.weatherDot} ${i === weatherIndex ? styles.weatherDotActive : ''}`}
                  onClick={(e) => { e.stopPropagation(); clearInterval(weatherTimer.current); setWeatherIndex(i); }}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ══ NAVIGATION BASSE ════════════════════════════ */}
      <nav className={styles.bottomNav} aria-label={t('menu.aria_label')}>
        {/* Bouton Accueil actif */}
        <button className={`${styles.navBtn} ${styles.navBtnActive}`} aria-current="page">
          <Home size={26} />
          <span>{t('menu.home')}</span>
        </button>

        <div className={styles.navDivider} aria-hidden="true" />

        {/* Sections principales */}
        {NAV_ITEMS.slice(0, 6).map(item => (
          <button
            key={item.id}
            className={`${styles.navBtn} ${activeNav === item.id ? styles.navBtnPressing : ''}`}
            onClick={() => go(item.id, item.route)}
            aria-label={t(item.labelKey)}
          >
            <item.Icon size={26} />
            <span>{t(item.labelKey)}</span>
          </button>
        ))}

        <div className={styles.navDivider} aria-hidden="true" />

        {/* Sélecteur de langue — dropdown vers le haut */}
        <div className={styles.langWrap} ref={langRef}>
          {langOpen && (
            <div className={styles.langDropdown} role="listbox" aria-label={t('common.change_language')}>
              {supportedLocales.map(loc => (
                <button
                  key={loc}
                  role="option"
                  aria-selected={loc === locale}
                  className={`${styles.langOption} ${loc === locale ? styles.langOptionActive : ''}`}
                  onClick={() => { setLocale(loc); setLangOpen(false); }}
                >
                  <span aria-hidden="true">{localesMeta[loc]?.flag}</span>
                  <span>{localesMeta[loc]?.nativeName}</span>
                </button>
              ))}
            </div>
          )}
          <button
            className={`${styles.langBtn} ${langOpen ? styles.langBtnOpen : ''}`}
            onClick={() => setLangOpen(v => !v)}
            aria-haspopup="listbox"
            aria-expanded={langOpen}
            aria-label={t('common.change_language')}
          >
            <Languages size={20} />
            <span className={styles.langCode}>{localesMeta[locale]?.flag} {locale.toUpperCase()}</span>
          </button>
        </div>
      </nav>

    </div>
  );
}

/* ─── Carte de service ─────────────────────────────────── */
function ServiceCard({ card, label, sub, active, onPress }) {
  return (
    <button
      className={`${styles.serviceCard} ${active ? styles.serviceCardActive : ''}`}
      onClick={onPress}
      aria-label={label}
    >
      <img src={card.img} alt="" className={styles.serviceCardImg} aria-hidden="true" />
      <div className={styles.serviceCardOverlay} />
      <div className={styles.serviceCardBody}>
        <div className={styles.serviceCardIcon} style={{ '--card-color': card.color }}>
          <card.Icon size={26} />
        </div>
        <div className={styles.serviceCardText}>
          <p className={styles.serviceCardName}>{label}</p>
          <p className={styles.serviceCardSub}>{sub}</p>
        </div>
        <ChevronRight size={26} className={styles.serviceCardChevron} />
      </div>
    </button>
  );
}

/* ─── Horloge ──────────────────────────────────────────── */
function Clock({ locale }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Mapping locale i18n → BCP 47 pour l'API Intl
  const BCP47 = { fr: 'fr-BF', en: 'en-US', de: 'de-DE', es: 'es-ES', pt: 'pt-PT', ar: 'ar-SA', zh: 'zh-CN', ja: 'ja-JP' };
  const intlLocale = BCP47[locale] ?? locale;

  return (
    <p className={styles.brandTime}>
      {time.toLocaleTimeString(intlLocale, { hour: '2-digit', minute: '2-digit' })}
      {' • '}
      {time.toLocaleDateString(intlLocale, { weekday: 'short', day: 'numeric', month: 'short' })}
    </p>
  );
}
