import React, { useState, useEffect } from 'react';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { useApi }       from '../../../hooks/useApi';
import { trackEvent }   from '../../../services/analytics';
import BackButton       from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../../ThemeToggle/ThemeToggle';
import styles           from './Events.module.css';

const CATEGORIES = ['all','culture','music','sport','gastronomy','festival','exhibition','hotel'];

const CATEGORY_ICONS = {
  all: '🗓️', culture: '🎭', music: '🎵', sport: '🏃',
  gastronomy: '🍽️', festival: '🎉', exhibition: '🖼️', hotel: '🏨',
};

export default function Events() {
  const { t, locale }          = useLanguage();
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  const params = { locale, upcoming: true, ...(category !== 'all' && { category }) };
  const { data, loading, error } = useApi('/events', params, { deps: [locale, category] });

  useEffect(() => { trackEvent('events', 'open'); }, []);

  if (selected) {
    return (
      <EventDetail
        event={selected}
        t={t}
        locale={locale}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <LanguageSwitcher />
      <ThemeToggle />

      {/* En-tête */}
      <div className={styles.header}>
        <h1 className={styles.title}>{t('events.title')}</h1>
        <p className={styles.subtitle}>{t('events.subtitle')}</p>
      </div>

      {/* Filtres par catégorie */}
      <div className={styles.filters} role="group" aria-label="Filtres catégories">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`${styles.filterBtn} ${category === cat ? styles.filterActive : ''}`}
            onClick={() => setCategory(cat)}
            aria-pressed={category === cat}
          >
            <span aria-hidden="true">{CATEGORY_ICONS[cat]}</span>
            {t(`events.categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className={styles.content}>
        {loading && (
          <div className={styles.center}><div className="spinner" /></div>
        )}

        {!loading && (error || !data?.length) && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🗓️</span>
            <p>{error ? t('events.error') : t('events.no_events')}</p>
          </div>
        )}

        {!loading && data?.length > 0 && (
          <>
            {/* Événements à la une */}
            {data.some(e => e.is_featured) && (
              <div className={styles.featuredRow}>
                {data.filter(e => e.is_featured).map(ev => (
                  <EventCardFeatured
                    key={ev.id}
                    event={ev}
                    t={t}
                    locale={locale}
                    onClick={() => {
                      setSelected(ev);
                      trackEvent('events', 'view', { event: ev.slug });
                    }}
                  />
                ))}
              </div>
            )}

            {/* Autres événements */}
            {data.some(e => !e.is_featured) && (
              <div className={styles.listGrid}>
                {data.filter(e => !e.is_featured).map(ev => (
                  <EventCardSmall
                    key={ev.id}
                    event={ev}
                    t={t}
                    locale={locale}
                    onClick={() => {
                      setSelected(ev);
                      trackEvent('events', 'view', { event: ev.slug });
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Carte featured (grande) ──────────────────────────── */
function EventCardFeatured({ event, t, locale, onClick }) {
  return (
    <button className={styles.cardFeatured} onClick={onClick}>
      {event.image_url ? (
        <img src={event.image_url} alt={event.title} className={styles.cardFeaturedImg} />
      ) : (
        <div className={styles.cardFeaturedImgPlaceholder}>
          {CATEGORY_ICONS[event.category]}
        </div>
      )}

      <div className={styles.cardFeaturedBody}>
        <div className={styles.cardTopRow}>
          <span className={`${styles.categoryBadge} ${styles[`cat_${event.category}`]}`}>
            {CATEGORY_ICONS[event.category]} {t(`events.categories.${event.category}`)}
          </span>
          {event.is_hotel && (
            <span className={styles.hotelBadge}>🏨 {t('events.hotel_event')}</span>
          )}
          <span className={`${styles.priceBadge} ${event.is_free ? styles.priceFree : ''}`}>
            {event.is_free ? t('events.free') : `${event.price_fcfa.toLocaleString('fr-BF')} F CFA`}
          </span>
        </div>

        <h2 className={styles.cardFeaturedTitle}>{event.title}</h2>
        <p className={styles.cardFeaturedDesc}>{event.description}</p>

        <div className={styles.cardMeta}>
          <span>📅 {formatDateRange(event, t, locale)}</span>
          {event.start_time && <span>🕐 {event.start_time.slice(0, 5)}</span>}
          <span>📍 {event.location}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Carte normale (petite) ───────────────────────────── */
function EventCardSmall({ event, t, locale, onClick }) {
  return (
    <button className={styles.cardSmall} onClick={onClick}>
      <div className={styles.cardSmallDate}>
        <span className={styles.cardSmallDay}>
          {new Date(event.start_date).toLocaleDateString(locale === 'fr' ? 'fr-BF' : 'en-GB', { day: '2-digit' })}
        </span>
        <span className={styles.cardSmallMonth}>
          {new Date(event.start_date).toLocaleDateString(locale === 'fr' ? 'fr-BF' : 'en-GB', { month: 'short' })}
        </span>
      </div>

      <div className={styles.cardSmallBody}>
        <div className={styles.cardSmallTop}>
          <span className={`${styles.categoryBadge} ${styles[`cat_${event.category}`]}`}>
            {CATEGORY_ICONS[event.category]} {t(`events.categories.${event.category}`)}
          </span>
          <span className={`${styles.priceBadge} ${event.is_free ? styles.priceFree : ''}`}>
            {event.is_free ? t('events.free') : `${event.price_fcfa.toLocaleString('fr-BF')} F`}
          </span>
        </div>
        <h3 className={styles.cardSmallTitle}>{event.title}</h3>
        <p className={styles.cardSmallLocation}>📍 {event.location}</p>
        {event.start_time && (
          <p className={styles.cardSmallTime}>🕐 {event.start_time.slice(0, 5)}</p>
        )}
      </div>
    </button>
  );
}

/* ── Vue détail ───────────────────────────────────────── */
function EventDetail({ event, t, locale, onBack }) {
  return (
    <div className={styles.detailPage}>
      <button className={styles.detailBackBtn} onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {t('events.detail_back')}
      </button>

      <div className={styles.detailContent}>
        {/* Image ou placeholder */}
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className={styles.detailImg} />
        ) : (
          <div className={styles.detailImgPlaceholder}>
            {CATEGORY_ICONS[event.category]}
          </div>
        )}

        <div className={styles.detailInfo}>
          {/* Badges */}
          <div className={styles.detailBadges}>
            <span className={`${styles.categoryBadge} ${styles[`cat_${event.category}`]}`}>
              {CATEGORY_ICONS[event.category]} {t(`events.categories.${event.category}`)}
            </span>
            {event.is_featured && (
              <span className={styles.featuredBadge}>⭐ {t('events.featured')}</span>
            )}
            <span className={`${styles.priceBadge} ${event.is_free ? styles.priceFree : ''}`}>
              {event.is_free
                ? `🎟 ${t('events.free')}`
                : `🎟 ${t('events.price')} : ${event.price_fcfa.toLocaleString('fr-BF')} F CFA`
              }
            </span>
          </div>

          <h1 className={styles.detailTitle}>{event.title}</h1>
          <p className={styles.detailDesc}>{event.description}</p>

          {/* Informations pratiques */}
          <div className={styles.detailMeta}>
            <MetaItem icon="📅" label={event.end_date ? t('events.from') : t('events.on')}>
              {formatDateRange(event, t, locale)}
            </MetaItem>

            {event.start_time && (
              <MetaItem icon="🕐" label={t('events.at')}>
                {event.start_time.slice(0, 5)}
                {event.end_time && ` — ${event.end_time.slice(0, 5)}`}
              </MetaItem>
            )}

            <MetaItem icon="📍" label={t('events.location')}>
              {event.location}
            </MetaItem>
          </div>

          {/* Tags */}
          {event.tags?.length > 0 && (
            <div className={styles.tagsBlock}>
              {event.tags.map((tag, i) => (
                <span key={i} className={styles.tag}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaItem({ icon, label, children }) {
  return (
    <div className={styles.metaItem}>
      <span className={styles.metaIcon}>{icon}</span>
      <div>
        <span className={styles.metaLabel}>{label}</span>
        <span className={styles.metaValue}>{children}</span>
      </div>
    </div>
  );
}

/* ── Utilitaire dates ─────────────────────────────────── */
function formatDateRange(event, t, locale) {
  const loc = locale === 'fr' ? 'fr-BF' : 'en-GB';
  const opts = { day: 'numeric', month: 'long' };
  const start = new Date(event.start_date).toLocaleDateString(loc, opts);
  if (!event.end_date) return start;
  const end = new Date(event.end_date).toLocaleDateString(loc, opts);
  return `${start} ${t('events.to')} ${end}`;
}
