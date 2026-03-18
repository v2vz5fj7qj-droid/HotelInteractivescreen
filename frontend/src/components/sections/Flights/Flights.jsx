import React, { useState, useEffect } from 'react';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { useApi }       from '../../../hooks/useApi';
import { trackEvent }   from '../../../services/analytics';
import BackButton       from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../../ThemeToggle/ThemeToggle';
import styles           from './Flights.module.css';

export default function Flights() {
  const { t }                          = useLanguage();
  const [tab, setTab]                  = useState('arrivals');
  const [search, setSearch]            = useState('');
  const [submitted, setSubmitted]      = useState('');

  const isSearch = submitted.length > 0;

  const listData = useApi('/flights', { type: tab }, { enabled: !isSearch, deps: [tab] });
  const searchData = useApi('/flights/search', { flight: submitted }, { enabled: isSearch, deps: [submitted] });

  const { data, loading, error } = isSearch ? searchData : listData;

  useEffect(() => { trackEvent('flights', 'open'); }, []);

  const flights = data?.flights ?? [];

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      setSubmitted(search.trim().toUpperCase());
      trackEvent('flights', 'search', { query: search.trim() });
    }
  };

  const clearSearch = () => { setSearch(''); setSubmitted(''); };

  return (
    <div className={styles.page}>
      <BackButton />
      <LanguageSwitcher />
      <ThemeToggle />

      <h1 className={styles.title}>{t('flights.title')}</h1>
      <p className={styles.airport}>🛫 {t('flights.airport')}</p>

      {/* Barre de recherche */}
      <form className={styles.searchBar} onSubmit={handleSearch}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value.toUpperCase())}
          placeholder={t('flights.search_placeholder')}
          className={styles.searchInput}
          aria-label={t('flights.search_placeholder')}
          maxLength={8}
        />
        <button type="submit" className={styles.searchBtn} disabled={!search.trim()}>
          {t('flights.search')}
        </button>
        {isSearch && (
          <button type="button" className={styles.clearBtn} onClick={clearSearch}>✕</button>
        )}
      </form>

      {/* Onglets Arrivées / Départs */}
      {!isSearch && (
        <div className={styles.tabs} role="tablist">
          {['arrivals', 'departures'].map(type => (
            <button
              key={type}
              role="tab"
              aria-selected={tab === type}
              className={`${styles.tab} ${tab === type ? styles.activeTab : ''}`}
              onClick={() => setTab(type)}
            >
              {type === 'arrivals' ? '🛬' : '🛫'} {t(`flights.${type}`)}
            </button>
          ))}
        </div>
      )}

      {/* Liste des vols */}
      <div className={styles.flightList} role="list">
        {loading && <div className={styles.center}><div className="spinner" /></div>}
        {!loading && !error && flights.length === 0 && (
          <div className={styles.empty}>{t('flights.no_results')}</div>
        )}
        {!loading && flights.map((flight, i) => (
          <FlightRow key={i} flight={flight} tab={tab} t={t} />
        ))}
        {!loading && error && (
          <div className={styles.empty} style={{color:'var(--c-accent)'}}>
            ⚠️ {t('flights.error')}
          </div>
        )}
      </div>
    </div>
  );
}

function FlightRow({ flight, tab, t }) {
  const isArrival = tab === 'arrivals';
  const info      = isArrival ? flight.arrival : flight.departure;
  const other     = isArrival ? flight.departure : flight.arrival;
  const delay     = info.delay || 0;
  const status    = delay > 0 ? 'delayed' : flight.status;

  const fmtTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('fr-BF', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.flightRow} role="listitem">
      <div className={styles.flightLeft}>
        <span className={styles.flightNum}>{flight.flight_number}</span>
        <span className={styles.airline}>{flight.airline}</span>
        <span className={`status-badge ${status}`}>{t(`flights.status.${status}`) || status}</span>
      </div>

      <div className={styles.flightCenter}>
        <div className={styles.routePoint}>
          <span className={styles.routeIata}>{other.iata}</span>
          <span className={styles.routeAirport}>{other.airport}</span>
        </div>
        <div className={styles.routeArrow}>
          {isArrival ? '→' : '→'}
        </div>
        <div className={styles.routePoint}>
          <span className={styles.routeIata}>{info.iata}</span>
          <span className={styles.routeAirport}>{info.airport}</span>
        </div>
      </div>

      <div className={styles.flightRight}>
        <div className={styles.timeBlock}>
          <span className={styles.timeLabel}>{t('flights.scheduled')}</span>
          <span className={styles.timeValue}>{fmtTime(info.scheduled)}</span>
        </div>
        {(info.estimated || info.actual) && (
          <div className={styles.timeBlock}>
            <span className={styles.timeLabel}>
              {info.actual ? t('flights.actual') : t('flights.estimated')}
            </span>
            <span className={`${styles.timeValue} ${delay > 0 ? styles.delayed : ''}`}>
              {fmtTime(info.actual || info.estimated)}
            </span>
          </div>
        )}
        {delay > 0 && (
          <span className={styles.delayBadge}>
            +{delay} {t('flights.delay_min')}
          </span>
        )}
        <div className={styles.gateInfo}>
          {info.terminal && <span>T{info.terminal}</span>}
          {info.gate     && <span className={styles.gate}>Porte {info.gate}</span>}
        </div>
      </div>
    </div>
  );
}
