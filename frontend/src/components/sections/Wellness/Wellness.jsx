import React, { useEffect, useState, useMemo } from 'react';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { useApi }       from '../../../hooks/useApi';
import { trackEvent }   from '../../../services/analytics';
import BackButton       from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../../ThemeToggle/ThemeToggle';
import styles           from './Wellness.module.css';

export default function Wellness() {
  const { t, locale }               = useLanguage();
  const { data, loading, error }    = useApi('/services', { locale });
  const [selected, setSelected]     = useState(null);

  const categories = useMemo(() => groupServicesByCategory(data), [data]);

  useEffect(() => { trackEvent('wellness', 'open'); }, []);

  if (loading) return <div className={styles.center}><div className="spinner" /></div>;
  if (error)   return <div className={styles.center}><p style={{color:'var(--c-accent)'}}>⚠️ {t('common.error')}</p></div>;

  if (selected) {
    return <ServiceDetail service={selected} t={t} onBack={() => setSelected(null)} />;
  }

  const showGroups = categories.length > 1;

  const scrollToCategory = (id) => {
    document.getElementById(`svc-cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={styles.page}>
      <BackButton />
      <LanguageSwitcher />
      <ThemeToggle />

      <div className={styles.header}>
        <h1 className={styles.title}>{t('wellness.title')}</h1>
        <p className={styles.subtitle}>{t('wellness.subtitle')}</p>
      </div>

      {/* Raccourcis catégories — pour sauter directement à une section */}
      {showGroups && (
        <div className={styles.categoryNav} role="group" aria-label="Catégories">
          {categories.map(cat => (
            <button
              key={cat.id}
              className={styles.categoryChip}
              onClick={() => scrollToCategory(cat.id)}
            >
              <span aria-hidden="true">{cat.icon}</span>
              {locale === 'fr' ? cat.label_fr : cat.label_en}
            </button>
          ))}
        </div>
      )}

      {/* Services regroupés par catégorie pour rester lisibles en nombre */}
      <div className={styles.content}>
        {categories.map(cat => (
          <div key={cat.id} id={`svc-cat-${cat.id}`} className={styles.categoryGroup}>
            {showGroups && (
              <div className={styles.categoryHeader}>
                <span className={styles.categoryLabel}>
                  {cat.icon} {locale === 'fr' ? cat.label_fr : cat.label_en}
                </span>
                <span className={styles.categoryCount}>{cat.services.length}</span>
                <div className={styles.categoryRule} />
              </div>
            )}
            <div className={styles.grid}>
              {cat.services.map(service => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  t={t}
                  onClick={() => {
                    setSelected(service);
                    trackEvent('wellness', 'view_service', { service: service.slug });
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Regroupement par catégorie (lisibilité quand il y a
   beaucoup de services) — l'API les trie déjà par ordre de
   catégorie puis d'affichage, on ne fait que les répartir ── */
function groupServicesByCategory(data) {
  if (!data?.length) return [];
  const byId = new Map();
  data.forEach(service => {
    if (!byId.has(service.category_id)) {
      byId.set(service.category_id, {
        id: service.category_id,
        icon: service.category_icon || '✨',
        label_fr: service.category_label_fr,
        label_en: service.category_label_en,
        services: [],
      });
    }
    byId.get(service.category_id).services.push(service);
  });
  return Array.from(byId.values());
}

/* ── Carte de service (compacte) ───────────────────────── */
function ServiceCard({ service, t, onClick }) {
  const hasDuration = service.duration_min != null;
  const isFree = service.price_fcfa === 0;
  return (
    <button
      className={styles.card}
      onClick={onClick}
      aria-label={hasDuration ? `${service.name} — ${service.duration_min} min` : service.name}
    >
      {service.image_url ? (
        <img src={service.image_url} alt={service.name} className={styles.cardImg} />
      ) : (
        <div className={styles.cardImgPlaceholder} aria-hidden="true">{service.category_icon || '✨'}</div>
      )}
      <div className={styles.cardBody}>
        <h2 className={styles.cardName}>{service.name}</h2>
        <p className={styles.cardDesc}>{service.description}</p>

        <div className={styles.cardMeta}>
          {hasDuration && (
            <span className={styles.pill}>⏱ {service.duration_min} {t('wellness.minutes')}</span>
          )}
          <span className={`${styles.pill} ${styles.pillPrimary} ${isFree ? styles.pillFree : ''}`}>
            {isFree ? t('wellness.free') : `${service.price_fcfa.toLocaleString('fr-BF')} ${t('wellness.fcfa')}`}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ── Détail du service (infos de réservation) ─────────── */
function ServiceDetail({ service, t, onBack }) {
  return (
    <div className={styles.detailPage}>
      <BackButton to="#" label={t('common.back')} />
      <button className={styles.backBtn} onClick={onBack} aria-label={t('common.back')} style={{display:'none'}} />

      {/* On surcharge le BackButton pour revenir à la liste */}
      <button className={styles.detailBackBtn} onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        {t('common.back')}
      </button>

      <div className={styles.detailContent}>
        {/* Image */}
        {service.image_url ? (
          <img src={service.image_url} alt={service.name} className={styles.detailImg} />
        ) : (
          <div className={styles.detailImgPlaceholder}>💆</div>
        )}

        <div className={styles.detailInfo}>
          <h1 className={styles.detailTitle}>{service.name}</h1>
          <p className={styles.detailDesc}>{service.description}</p>

          {/* Prix & durée */}
          <div className={styles.detailMeta}>
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaLabel}>{t('wellness.duration')}</span>
              <span className={styles.detailMetaValue}>
                {service.duration_min} {t('wellness.minutes')}
              </span>
            </div>
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaLabel}>{t('wellness.price')}</span>
              <span className={`${styles.detailMetaValue} ${styles.priceValue}`}>
                {service.price_fcfa.toLocaleString('fr-BF')} {t('wellness.fcfa')}
              </span>
            </div>
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaLabel}>{t('wellness.available_hours')}</span>
              <span className={styles.detailMetaValue}>{service.available_hours}</span>
            </div>
            <div className={styles.detailMetaItem}>
              <span className={styles.detailMetaLabel}>{t('wellness.available_days')}</span>
              <span className={styles.detailMetaValue}>{service.available_days}</span>
            </div>
          </div>

          {/* Bienfaits */}
          {service.benefits?.length > 0 && (
            <div className={styles.benefitsBlock}>
              <h3 className={styles.benefitsTitle}>{t('wellness.benefits')}</h3>
              <ul className={styles.benefitsList}>
                {service.benefits.map((b, i) => <li key={i}>✓ {b}</li>)}
              </ul>
            </div>
          )}

          {/* ── INFOS DE RÉSERVATION (pas de bouton "réserver") ── */}
          <div className={styles.bookingCard}>
            <h3 className={styles.bookingTitle}>
              📋 {t('wellness.book_info_title')}
            </h3>
            <p className={styles.bookingText}>{service.booking_info}</p>

            {service.contact_phone && (
              <a
                href={`tel:${service.contact_phone}`}
                className={styles.callBtn}
                onClick={() => trackEvent('wellness', 'call_spa', { service: service.slug })}
              >
                📞 {t('wellness.contact')} — {service.contact_phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
