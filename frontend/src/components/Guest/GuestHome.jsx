import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CloudSun, PlaneTakeoff, MapPin, Sparkles, CalendarDays,
  Phone, Star, BadgeDollarSign, Wifi, Check, LogOut, Clock,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useHotel }    from '../../contexts/HotelContext';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../ThemeToggle/ThemeToggle';
import styles from './Guest.module.css';

/* ─── Sections ouvertes au visiteur ────────────────────────────────
   Le transfert mobile du kiosque est volontairement absent : son seul rôle est
   d'envoyer la borne vers un téléphone, ce qui n'a plus d'objet ici. */
const SECTIONS = [
  { section: 'weather',  Icon: CloudSun,         labelKey: 'menu.weather'  },
  { section: 'flights',  Icon: PlaneTakeoff,     labelKey: 'menu.flights'  },
  { section: 'map',      Icon: MapPin,           labelKey: 'menu.map'      },
  { section: 'events',   Icon: CalendarDays,     labelKey: 'menu.events'   },
  { section: 'wellness', Icon: Sparkles,         labelKey: 'menu.wellness' },
  { section: 'info',     Icon: Phone,            labelKey: 'menu.info'     },
  { section: 'currency', Icon: BadgeDollarSign,  labelKey: 'menu.currency' },
  { section: 'feedback', Icon: Star,             labelKey: 'menu.feedback' },
];

// 'HH:MM:SS' → 'HH:MM' : la seconde n'apporte rien à une heure de départ.
function shortTime(value) {
  if (!value) return null;
  return String(value).slice(0, 5);
}

function formatDate(value, locale) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale || 'fr', { day: 'numeric', month: 'long' });
}

/**
 * Accueil de l'espace visiteur : carte « Mon séjour » puis liste des sections.
 *
 * Menu en liste verticale et non en menu radial : le radial est calibré pour une
 * borne portrait de 55 pouces, il est inutilisable sur un téléphone.
 */
export default function GuestHome({ stay, settings, onLogout }) {
  const { hotelSlug } = useParams();
  const navigate      = useNavigate();
  const { t, locale } = useLanguage();
  const { hotel, isSectionEnabled } = useHotel();
  const [copied, setCopied] = useState(false);

  // Un hôtel qui a désactivé une section dans ses paramètres ne doit pas la voir
  // réapparaître côté client : le menu visiteur suit le même filtre que le kiosque.
  const sections = SECTIONS.filter(s => isSectionEnabled(s.section));

  const welcome = settings?.[`welcome_message_${locale}`] || settings?.welcome_message_fr;

  async function copyWifi() {
    try {
      await navigator.clipboard.writeText(settings.wifi_password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papier refusé (contexte non sécurisé) : le mot de passe reste
      // affiché en clair, le client peut le recopier.
    }
  }

  return (
    <div className={styles.homePage}>
      <header className={styles.homeHeader}>
        <div className={styles.homeHeaderText}>
          <p className={styles.homeHotel}>{hotel?.nom || settings?.nom}</p>
          {stay?.guest_name && (
            <h1 className={styles.homeWelcome}>
              {t('guest.welcome')} {stay.guest_name}
            </h1>
          )}
        </div>
        <div className={styles.homeHeaderActions}>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* ── Carte « Mon séjour » — réservée au client authentifié ── */}
      <section className={styles.stayCard} aria-label={t('guest.my_stay')}>
        <h2 className={styles.stayTitle}>{t('guest.my_stay')}</h2>

        {welcome && <p className={styles.stayWelcome}>{welcome}</p>}

        <dl className={styles.stayGrid}>
          {stay?.room_number && (
            <div className={styles.stayItem}>
              <dt>{t('guest.room')}</dt>
              <dd>{stay.room_number}</dd>
            </div>
          )}
          {shortTime(settings?.checkout_time) && (
            <div className={styles.stayItem}>
              <dt><Clock size={14} aria-hidden="true" /> {t('guest.checkout')}</dt>
              <dd>{shortTime(settings.checkout_time)}</dd>
            </div>
          )}
          {stay?.valid_until && (
            <div className={styles.stayItem}>
              <dt>{t('guest.until')}</dt>
              <dd>{formatDate(stay.valid_until, locale)}</dd>
            </div>
          )}
        </dl>

        {settings?.wifi_name && (
          <div className={styles.wifiBox}>
            <div className={styles.wifiText}>
              <span className={styles.wifiLabel}>
                <Wifi size={16} aria-hidden="true" /> {t('guest.wifi')}
              </span>
              <span className={styles.wifiName}>{settings.wifi_name}</span>
              {settings.wifi_password && (
                <code className={styles.wifiPass}>{settings.wifi_password}</code>
              )}
            </div>
            {settings.wifi_password && (
              <button type="button" className={styles.wifiCopy} onClick={copyWifi}>
                {copied
                  ? <><Check size={16} aria-hidden="true" /> {t('guest.wifi_copied')}</>
                  : t('guest.wifi_copy')}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── Sections ── */}
      <h2 className={styles.menuTitle}>{t('guest.menu_title')}</h2>
      <nav className={styles.menuList}>
        {sections.map(({ section, Icon, labelKey }) => (
          <button
            key={section}
            type="button"
            className={styles.menuItem}
            onClick={() => navigate(`/${hotelSlug}/visiteur/${section}`)}
          >
            <Icon size={22} aria-hidden="true" />
            <span>{t(labelKey)}</span>
          </button>
        ))}
      </nav>

      <button type="button" className={styles.logoutBtn} onClick={onLogout}>
        <LogOut size={16} aria-hidden="true" /> {t('guest.logout')}
      </button>
    </div>
  );
}
