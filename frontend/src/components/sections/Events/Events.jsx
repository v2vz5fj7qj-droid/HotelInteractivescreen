import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { useApi }       from '../../../hooks/useApi';
import { trackEvent }   from '../../../services/analytics';
import SectionChrome   from '../../SectionChrome/SectionChrome';
import styles           from './Events.module.css';

const ALL_ENTRY = { key_name: 'all', icon: '🗓️', label_fr: 'Tout', label_en: 'All' };

export default function Events() {
  const { t, locale }          = useLanguage();
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState(null);

  const { data: catsData } = useApi('/events/categories');
  const categories = useMemo(() => [ALL_ENTRY, ...(catsData || [])], [catsData]);
  const catMeta = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.key_name] = c; });
    return m;
  }, [categories]);

  const params = { locale, upcoming: true, ...(category !== 'all' && { category }) };
  const { data, loading, error } = useApi('/events', params, { deps: [locale, category] });

  const groupedSections = useMemo(() => {
    if (!data?.length) return [];
    return groupEventsByDate(data.filter(e => !e.is_featured));
  }, [data]);

  useEffect(() => { trackEvent('events', 'open'); }, []);

  if (selected) {
    return (
      <EventDetail
        event={selected}
        t={t}
        locale={locale}
        catMeta={catMeta}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className={styles.page}>
      <SectionChrome />

      {/* En-tête */}
      <div className={styles.header}>
        <h1 className={styles.title}>{t('events.title')}</h1>
        <p className={styles.subtitle}>{t('events.subtitle')}</p>
      </div>

      {/* Filtres par catégorie */}
      <div className={styles.filters} role="group" aria-label="Filtres catégories">
        {categories.map(cat => (
          <button
            key={cat.key_name}
            className={`${styles.filterBtn} ${category === cat.key_name ? styles.filterActive : ''}`}
            onClick={() => setCategory(cat.key_name)}
            aria-pressed={category === cat.key_name}
          >
            <span aria-hidden="true">{cat.icon}</span>
            {locale === 'fr' ? cat.label_fr : cat.label_en}
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
            {/* Événements à la une — défilement horizontal, hauteur fixe */}
            {data.some(e => e.is_featured) && (
              <div className={styles.featuredScroll}>
                {data.filter(e => e.is_featured).map(ev => (
                  <EventCardFeatured
                    key={ev.id}
                    event={ev}
                    t={t}
                    locale={locale}
                    catMeta={catMeta}
                    onClick={() => {
                      setSelected(ev);
                      trackEvent('events', 'view', { event: ev.slug });
                    }}
                  />
                ))}
              </div>
            )}

            {/* Autres événements — regroupés par date pour rester lisibles en nombre */}
            {groupedSections.map(group => (
              <div key={group.key} className={styles.dateGroup}>
                <div className={styles.dateGroupHeader}>
                  <span className={styles.dateGroupLabel}>{t(`events.groups.${group.key}`)}</span>
                  <span className={styles.dateGroupCount}>{group.events.length}</span>
                  <div className={styles.dateGroupRule} />
                </div>
                <div className={styles.compactGrid}>
                  {group.events.map(ev => (
                    <EventCardCompact
                      key={ev.id}
                      event={ev}
                      t={t}
                      locale={locale}
                      catMeta={catMeta}
                      onClick={() => {
                        setSelected(ev);
                        trackEvent('events', 'view', { event: ev.slug });
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Carte featured (grande) ──────────────────────────── */
function EventCardFeatured({ event, t, locale, catMeta, onClick }) {
  const cat = catMeta?.[event.category];
  const catIcon  = cat?.icon  || '🗓️';
  const catLabel = locale === 'fr' ? (cat?.label_fr || event.category) : (cat?.label_en || event.category);
  return (
    <button className={styles.cardFeatured} onClick={onClick}>
      {event.image_url ? (
        <img src={event.image_url} alt={event.title} className={styles.cardFeaturedImg} />
      ) : (
        <div className={styles.cardFeaturedImgPlaceholder}>
          {catIcon}
        </div>
      )}

      <div className={styles.cardFeaturedBody}>
        <div className={styles.cardTopRow}>
          <span className={`${styles.categoryBadge} ${styles[`cat_${event.category}`]}`}>
            {catIcon} {catLabel}
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
          <span className={styles.cardMetaDate}>
            {event.is_recurrent ? `🔁 ${event.recurrence_label}` : `📅 ${formatShortDate(event, locale)}`}
            {event.start_time && ` · 🕐 ${event.start_time.slice(0, 5)}`}
          </span>
          <span className={styles.cardMetaLocation}>📍 {event.location}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Carte compacte (liste groupée par date) ───────────── */
function EventCardCompact({ event, t, locale, catMeta, onClick }) {
  const cat = catMeta?.[event.category];
  const catIcon  = cat?.icon  || '🗓️';
  return (
    <button className={styles.cardCompact} onClick={onClick}>
      <span className={`${styles.cardCompactIcon} ${styles[`cat_${event.category}`]}`} aria-hidden="true">
        {event.is_recurrent ? '🔁' : catIcon}
      </span>
      <span className={styles.cardCompactBody}>
        <span className={styles.cardCompactTitle}>{event.title}</span>
        <span className={styles.cardCompactDate}>
          {event.is_recurrent ? `🔁 ${event.recurrence_label}` : `📅 ${formatShortDate(event, locale)}`}
          {event.start_time && ` · 🕐 ${event.start_time.slice(0, 5)}`}
        </span>
        <span className={styles.cardCompactLocation}>📍 {event.location}</span>
      </span>
      {event.is_hotel && <span className={styles.cardCompactHotel} aria-label={t('events.hotel_event')}>🏨</span>}
      <span className={`${styles.cardCompactPrice} ${event.is_free ? styles.priceFree : ''}`}>
        {event.is_free ? t('events.free') : `${event.price_fcfa.toLocaleString('fr-BF')} F`}
      </span>
    </button>
  );
}

/* ── Vue détail ───────────────────────────────────────── */
function EventDetail({ event, t, locale, catMeta, onBack }) {
  const cat = catMeta?.[event.category];
  const catIcon  = cat?.icon  || '🗓️';
  const catLabel = locale === 'fr' ? (cat?.label_fr || event.category) : (cat?.label_en || event.category);
  return (
    <div className={styles.detailPage}>
      <SectionChrome onBack={onBack} backLabel={t('events.detail_back')} />

      <div className={styles.detailContent}>
        {/* Image ou placeholder */}
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className={styles.detailImg} />
        ) : (
          <div className={styles.detailImgPlaceholder}>
            {catIcon}
          </div>
        )}

        <div className={styles.detailInfo}>
          {/* Badges */}
          <div className={styles.detailBadges}>
            <span className={`${styles.categoryBadge} ${styles[`cat_${event.category}`]}`}>
              {catIcon} {catLabel}
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
            <MetaItem icon="📅" label={event.is_recurrent ? t('events.on') : (event.end_date ? t('events.from') : t('events.on'))}>
              {event.is_recurrent ? event.recurrence_label : formatDateRange(event, t, locale)}
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

/* ── Regroupement par date (lisibilité quand il y a beaucoup d'événements) ── */
function groupEventsByDate(events) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const buckets = { today: [], tomorrow: [], this_week: [], later: [] };
  events.forEach(ev => {
    const evDate = new Date(ev.start_date);
    evDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((evDate - today) / 86400000);
    if (diffDays <= 0)      buckets.today.push(ev);
    else if (diffDays === 1) buckets.tomorrow.push(ev);
    else if (diffDays <= 7)  buckets.this_week.push(ev);
    else                     buckets.later.push(ev);
  });

  return ['today', 'tomorrow', 'this_week', 'later']
    .map(key => ({ key, events: buckets[key] }))
    .filter(group => group.events.length > 0);
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

/* Version courte (carte compacte) : "20 sept" ou "20–25 sept" */
function formatShortDate(event, locale) {
  const loc = locale === 'fr' ? 'fr-BF' : 'en-GB';
  const opts = { day: 'numeric', month: 'short' };
  const start = new Date(event.start_date).toLocaleDateString(loc, opts);
  if (!event.end_date) return start;
  const end = new Date(event.end_date).toLocaleDateString(loc, opts);
  return `${start} – ${end}`;
}
