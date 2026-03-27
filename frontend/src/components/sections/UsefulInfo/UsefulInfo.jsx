import React, { useState, useEffect, useRef } from 'react';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { useApi }       from '../../../hooks/useApi';
import { trackEvent }   from '../../../services/analytics';
import BackButton       from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../../ThemeToggle/ThemeToggle';
import styles           from './UsefulInfo.module.css';

const CATEGORIES = ['all', 'taxi', 'doctor', 'pharmacy', 'shuttle', 'emergency', 'embassy', 'bank'];

const CATEGORY_ICONS = {
  all:       '📋',
  taxi:      '🚕',
  doctor:    '👨‍⚕️',
  pharmacy:  '💊',
  shuttle:   '🚌',
  emergency: '🚨',
  embassy:   '🏛️',
  bank:      '🏦',
};

const CATEGORY_COLORS = {
  taxi:      '#F59E0B',
  doctor:    '#3B82F6',
  pharmacy:  '#10B981',
  shuttle:   '#8B5CF6',
  emergency: '#EF4444',
  embassy:   '#6366F1',
  bank:      '#0EA5E9',
};

export default function UsefulInfo() {
  const { t, locale }           = useLanguage();
  const [catIndex, setCatIndex] = useState(0);
  const category                = CATEGORIES[catIndex];
  const touchStart              = useRef(null);

  const params = { locale };
  const { data, loading, error } = useApi('/info', params, { deps: [locale] });

  useEffect(() => { trackEvent('info', 'open'); }, []);

  const onTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStart.current.y);
    touchStart.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < dy) return;
    setCatIndex(i => dx < 0
      ? (i + 1) % CATEGORIES.length
      : (i - 1 + CATEGORIES.length) % CATEGORIES.length
    );
  };

  const filtered = !data ? [] : (
    category === 'all' ? data : data.filter(c => c.category === category)
  );

  // Grouper par catégorie quand "all" est sélectionné
  const grouped = category === 'all'
    ? CATEGORIES.filter(cat => cat !== 'all' && data?.some(c => c.category === cat))
        .map(cat => ({ cat, items: data.filter(c => c.category === cat) }))
    : [{ cat: category, items: filtered }];

  return (
    <div className={styles.page} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <BackButton />
      <LanguageSwitcher />
      <ThemeToggle />

      <div className={styles.header}>
        <h1 className={styles.title}>{t('info.title')}</h1>
      </div>

      {/* Filtres catégories */}
      <div className={styles.filters} role="group" aria-label="Filtres catégories">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat}
            className={`${styles.filterBtn} ${catIndex === i ? styles.filterActive : ''}`}
            onClick={() => setCatIndex(i)}
            aria-pressed={catIndex === i}
          >
            <span aria-hidden="true">{CATEGORY_ICONS[cat]}</span>
            {t(`info.categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div key={catIndex} className={`${styles.content} ${styles.slideIn}`}>
        {loading && <div className={styles.center}><div className="spinner" /></div>}

        {!loading && (error || !data?.length) && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📞</span>
            <p>{error ? t('info.error') : t('info.no_results')}</p>
          </div>
        )}

        {!loading && data?.length > 0 && grouped.map(({ cat, items }) => (
          items.length === 0 ? null : (
            <div key={cat} className={styles.group}>
              {category === 'all' && (
                <div className={styles.groupHeader}>
                  <span className={styles.groupIcon}>{CATEGORY_ICONS[cat]}</span>
                  <h2 className={styles.groupTitle}>{t(`info.categories.${cat}`)}</h2>
                </div>
              )}
              <div className={styles.grid}>
                {items.map(contact => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    color={CATEGORY_COLORS[contact.category]}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )
        ))}

        {!loading && data?.length > 0 && filtered.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>{CATEGORY_ICONS[category]}</span>
            <p>{t('info.no_results')}</p>
          </div>
        )}
      </div>

      {/* Dots de navigation */}
      <div className={styles.sliderDots}>
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat}
            className={`${styles.sliderDot} ${i === catIndex ? styles.sliderDotActive : ''}`}
            onClick={() => setCatIndex(i)}
            aria-label={t(`info.categories.${cat}`)}
            aria-current={i === catIndex}
          />
        ))}
      </div>
    </div>
  );
}

function ContactCard({ contact, color, t }) {
  return (
    <div className={styles.card} style={{ '--cat-color': color }}>
      <div className={styles.cardTop}>
        <div className={styles.cardAccent} />
        <div className={styles.cardMain}>
          <p className={styles.cardName}>{contact.name}</p>
          {contact.description && (
            <p className={styles.cardDesc}>{contact.description}</p>
          )}
          {contact.address && (
            <p className={styles.cardAddress}>📍 {contact.address}</p>
          )}
        </div>
        {contact.available_24h === 1 && (
          <span className={styles.badge24}>{t('info.available_24h')}</span>
        )}
      </div>

      {(contact.phone || contact.whatsapp || contact.website) && (
        <div className={styles.cardActions}>
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className={styles.actionBtn}>
              📞 {contact.phone}
            </a>
          )}
          {contact.whatsapp && (
            <a
              href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
              className={`${styles.actionBtn} ${styles.actionWa}`}
            >
              💬 {t('info.whatsapp')}
            </a>
          )}
          {contact.website && (
            <a href={contact.website} className={`${styles.actionBtn} ${styles.actionWeb}`}>
              🌐 {new URL(contact.website).hostname}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
