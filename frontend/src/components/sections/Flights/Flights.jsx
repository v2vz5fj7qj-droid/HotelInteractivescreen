import React, { useState, useEffect } from 'react';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { useHotel }     from '../../../contexts/HotelContext';
import { useApi }       from '../../../hooks/useApi';
import { trackEvent }   from '../../../services/analytics';
import BackButton       from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../../ThemeToggle/ThemeToggle';
import styles           from './Flights.module.css';

const RETRY_DELAY_MS  = 30_000;
const STALE_THRESHOLD = 35 * 60 * 1000; // 35 min — dépasse l'intervalle de 30 min

export default function Flights() {
  const { t }                          = useLanguage();
  const { airports }                   = useHotel();
  const [selectedAirport, setSelectedAirport] = useState(null);
  const [tab, setTab]                  = useState('arrivals');
  const [search, setSearch]            = useState('');
  const [submitted, setSubmitted]      = useState('');
  const [retryKey, setRetryKey]        = useState(0);
  const [now, setNow]                  = useState(Date.now());

  // Initialiser l'aéroport sélectionné au premier chargement
  useEffect(() => {
    if (airports?.length > 0 && !selectedAirport) {
      setSelectedAirport(airports[0].code);
    }
  }, [airports, selectedAirport]);

  // Horloge pour rafraîchir l'affichage "il y a X min" toutes les minutes
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const isSearch = submitted.length > 0;

  const listData   = useApi(
    '/flights',
    { type: tab, ...(selectedAirport ? { airport: selectedAirport } : {}) },
    { enabled: !isSearch && !!selectedAirport, deps: [tab, retryKey, selectedAirport] }
  );
  const searchData = useApi('/flights/search', { flight: submitted }, { enabled: isSearch, deps: [submitted] });

  const { data, loading, error } = isSearch ? searchData : listData;

  const isPending    = !isSearch && data?._pending;
  const refreshedAt  = data?.refreshed_at ?? null;
  const ageMs        = refreshedAt ? now - refreshedAt : null;
  const ageMin       = ageMs !== null ? Math.floor(ageMs / 60_000) : null;
  const isStale      = ageMs !== null && ageMs > STALE_THRESHOLD;

  useEffect(() => { trackEvent('flights', 'open'); }, []);

  useEffect(() => {
    if (!isPending) return;
    const timer = setTimeout(() => setRetryKey(k => k + 1), RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isPending, retryKey]);

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

      {/* Sélecteur d'aéroport — visible uniquement si plusieurs aéroports affectés */}
      {airports?.length > 1 && (
        <div className={styles.airportSelector} role="tablist" aria-label="Choisir un aéroport">
          {airports.map(ap => (
            <button
              key={ap.code}
              role="tab"
              aria-selected={selectedAirport === ap.code}
              className={`${styles.airportTab} ${selectedAirport === ap.code ? styles.airportTabActive : ''}`}
              onClick={() => { setSelectedAirport(ap.code); setSubmitted(''); setSearch(''); }}
            >
              <span className={styles.airportCode}>{ap.code}</span>
              <span className={styles.airportLabel}>{ap.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Nom de l'aéroport courant */}
      {airports?.length > 0 && selectedAirport && (
        <p className={styles.airport}>
          🛫 {airports.find(a => a.code === selectedAirport)?.label ?? selectedAirport}
        </p>
      )}

      {/* Badge dernière mise à jour */}
      {refreshedAt && !isPending && (
        <div className={`${styles.refreshBadge} ${isStale ? styles.refreshBadgeStale : ''}`}>
          {isStale
            ? `⚠️ Données de il y a ${ageMin} min`
            : `✓ Mis à jour il y a ${ageMin === 0 ? '< 1' : ageMin} min`
          }
        </div>
      )}

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
        {!loading && isPending && (
          <div className={styles.empty}>{t('flights.pending') || 'Chargement des données en cours...'}</div>
        )}
        {!loading && !isPending && !error && flights.length === 0 && (
          <div className={styles.empty}>{t('flights.no_results')}</div>
        )}
        {!loading && flights.map((flight, i) => (
          <FlightRow key={i} flight={flight} tab={tab} isSearch={isSearch} t={t} />
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

function FlightRow({ flight, tab, isSearch, t }) {
  // En mode recherche : on affiche toujours départ → arrivée (route complète)
  // En mode liste : on s'adapte à l'onglet actif (arrivées ou départs)
  const isArrival = !isSearch && tab === 'arrivals';
  const dep    = flight.departure;
  const arr    = flight.arrival;
  const info   = isArrival ? arr : dep;   // côté "principal" (horaire affiché à droite)
  const other  = isArrival ? dep : arr;   // côté "origine"
  const delay  = info.delay || 0;
  const status = delay > 0 ? 'delayed' : flight.status;

  const fmtTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('fr-BF', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.flightRow} role="listitem">
      <div className={styles.flightLeft}>
        {flight.airline_icao && (
          <img
            src={`/airlines/${flight.airline_icao}.png`}
            alt={flight.airline}
            className={styles.airlineLogo}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <span className={styles.flightNum}>{flight.flight_number}</span>
        <span className={styles.airline}>{flight.airline}</span>
        <span className={`status-badge ${status}`}>{t(`flights.status.${status}`) || status}</span>
      </div>

      <div className={styles.flightCenter}>
        <div className={styles.routePoint}>
          <span className={styles.routeIata}>{dep.iata}</span>
          <span className={styles.routeAirport}>{dep.airport}</span>
        </div>
        <div className={styles.routeArrow}>→</div>
        <div className={styles.routePoint}>
          <span className={styles.routeIata}>{arr.iata}</span>
          <span className={styles.routeAirport}>{arr.airport}</span>
        </div>
      </div>

      <div className={styles.flightRight}>
        {isSearch ? (
          // Mode recherche : afficher les deux horaires (départ + arrivée)
          <>
            <div className={styles.timeBlock}>
              <span className={styles.timeLabel}>🛫 {fmtTime(dep.actual || dep.estimated || dep.scheduled)}</span>
              <span className={styles.timeLabel}>🛬 {fmtTime(arr.actual || arr.estimated || arr.scheduled)}</span>
            </div>
          </>
        ) : (
          // Mode liste : afficher l'horaire du côté actif (arrivée ou départ)
          <>
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
              <span className={styles.delayBadge}>+{delay} {t('flights.delay_min')}</span>
            )}
          </>
        )}
        <div className={styles.gateInfo}>
          {info.terminal && <span>T{info.terminal}</span>}
          {info.gate     && <span className={styles.gate}>Porte {info.gate}</span>}
        </div>
      </div>
    </div>
  );
}
