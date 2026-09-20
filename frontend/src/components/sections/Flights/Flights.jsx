import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { useHotel }     from '../../../contexts/HotelContext';
import { useApi }       from '../../../hooks/useApi';
import { useDebounce }  from '../../../hooks/useDebounce';
import { trackEvent }   from '../../../services/analytics';
import BackButton       from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../../ThemeToggle/ThemeToggle';
import styles           from './Flights.module.css';

const RETRY_DELAY_MS   = 30_000;
const STALE_THRESHOLD  = 35 * 60 * 1000; // 35 min — dépasse l'intervalle de 30 min
const POLL_INTERVAL_MS = 2 * 60 * 1000;  // re-fetch toutes les 2 min pour capter auto & manuel
const SUGGEST_DEBOUNCE_MS = 300;
const SUGGEST_MIN_CHARS   = 2;
const SUGGEST_MAX_ITEMS   = 6;

const PLANE_PATH =
  'M12 2.5c.7 0 1.2.6 1.2 1.3v5.6l7.3 4.3v2.1l-7.3-2.2v4.5l2.2 1.6v1.8L12 20.8l-3.4 1.7v-1.8l2.2-1.6v-4.5L3.5 16.8v-2.1l7.3-4.3V3.8c0-.7.5-1.3 1.2-1.3z';

function PlaneIcon({ climbing, className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <g transform={`rotate(${climbing ? 45 : 135} 12 12)`}>
        <path d={PLANE_PATH} fill="currentColor" />
      </g>
    </svg>
  );
}

// Le nom brut de la source est un nom d'aéroport ; on retire le suffixe pour garder le lieu
function placeName(airport, iata) {
  if (!airport) return iata || '—';
  return airport
    .replace(/\s+(international|intl\.?)?\s*airport$/i, '')
    .replace(/\s+(international|intl\.?)$/i, '')
    .trim() || iata || '—';
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function Flights() {
  const { t, locale }                         = useLanguage();
  const { airports }                          = useHotel();
  const [selectedAirport, setSelectedAirport] = useState(null);
  const [tab, setTab]                         = useState('arrivals');
  const [search, setSearch]                   = useState('');
  const [submitted, setSubmitted]             = useState('');
  const [retryKey, setRetryKey]               = useState(0);
  const [now, setNow]                         = useState(Date.now());
  const [suggestOpen, setSuggestOpen]         = useState(false);
  const [activeIndex, setActiveIndex]         = useState(-1);
  const searchBarRef                          = useRef(null);

  useEffect(() => {
    if (airports?.length > 0 && !selectedAirport) setSelectedAirport(airports[0].code);
  }, [airports, selectedAirport]);

  // Horloge : alimente l'heure affichée et l'âge des données
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const isSearch = submitted.length > 0;

  const listData   = useApi(
    '/flights',
    { type: tab, ...(selectedAirport ? { airport: selectedAirport } : {}) },
    { enabled: !isSearch && !!selectedAirport, deps: [tab, retryKey, selectedAirport] }
  );
  const searchData = useApi('/flights/search', { flight: submitted }, { enabled: isSearch, deps: [submitted] });

  const { data, loading, error } = isSearch ? searchData : listData;

  // Suggestions en direct pendant la saisie, avant validation de la recherche
  const debouncedSearch  = useDebounce(search.trim(), SUGGEST_DEBOUNCE_MS);
  const suggestEnabled   = suggestOpen && !isSearch && debouncedSearch.length >= SUGGEST_MIN_CHARS;
  const suggestData      = useApi(
    '/flights/search',
    { flight: debouncedSearch },
    { enabled: suggestEnabled, deps: [debouncedSearch] }
  );
  const suggestions       = suggestEnabled ? (suggestData.data?.flights ?? []).slice(0, SUGGEST_MAX_ITEMS) : [];
  const showSuggestions   = suggestEnabled && (suggestData.loading || suggestions.length > 0);

  // Ferme la liste de suggestions au clic/tap en dehors de la barre de recherche
  useEffect(() => {
    function handleOutside(e) {
      if (searchBarRef.current && !searchBarRef.current.contains(e.target)) {
        setSuggestOpen(false);
      }
    }
    if (suggestOpen) document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [suggestOpen]);

  const isPending   = !isSearch && data?._pending;
  const refreshedAt = data?.refreshed_at ?? null;
  const ageMs       = refreshedAt ? now - refreshedAt : null;
  const ageMin      = ageMs !== null ? Math.floor(ageMs / 60_000) : null;
  const isStale     = ageMs !== null && ageMs > STALE_THRESHOLD;

  useEffect(() => { trackEvent('flights', 'open'); }, []);

  useEffect(() => {
    if (!isPending) return;
    const timer = setTimeout(() => setRetryKey(k => k + 1), RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isPending, retryKey]);

  useEffect(() => {
    const timer = setInterval(() => setRetryKey(k => k + 1), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const flights     = data?.flights ?? [];
  const isArrival   = !isSearch && tab === 'arrivals';
  const currentAp   = airports?.find(a => a.code === selectedAirport);
  const airportName = currentAp?.label ?? t('flights.airport');

  const fmtTime = (iso) =>
    iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '—';

  const dayLabel = (d) => {
    const midnight = (x) => { const c = new Date(x); c.setHours(0, 0, 0, 0); return c; };
    const diff = Math.round((midnight(d) - midnight(new Date())) / 86_400_000);
    if (diff === 0) return t('flights.today');
    if (diff === 1) return t('flights.tomorrow');
    return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Insère un séparateur de jour : la source couvre 24 h glissantes et franchit minuit
  const rows = useMemo(() => {
    if (isSearch) return flights.map((f, i) => ({ kind: 'flight', flight: f, id: `f${i}` }));

    const out = [];
    let lastKey = null;
    const todayKey = dayKey(new Date());

    flights.forEach((flight, i) => {
      const side = isArrival ? flight.arrival : flight.departure;
      const iso  = side?.scheduled || side?.estimated || side?.actual;
      const date = iso ? new Date(iso) : null;
      const key  = date ? dayKey(date) : null;

      if (key && key !== lastKey) {
        if (lastKey !== null || key !== todayKey) {
          out.push({ kind: 'divider', label: dayLabel(date), id: `d${key}` });
        }
        lastKey = key;
      }
      out.push({ kind: 'flight', flight, id: `f${i}` });
    });
    return out;
  }, [flights, isArrival, isSearch, locale, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      setSubmitted(search.trim().toUpperCase());
      trackEvent('flights', 'search', { query: search.trim() });
    }
    setSuggestOpen(false);
    setActiveIndex(-1);
  };

  const clearSearch = () => {
    setSearch('');
    setSubmitted('');
    setSuggestOpen(false);
    setActiveIndex(-1);
  };

  const selectSuggestion = (flight) => {
    setSearch(flight.flight_number);
    setSubmitted(flight.flight_number);
    setSuggestOpen(false);
    setActiveIndex(-1);
    trackEvent('flights', 'search_suggestion', { flight: flight.flight_number });
  };

  const handleSearchKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
      setActiveIndex(-1);
    }
  };

  const heading = isSearch ? t('flights.title') : t(`flights.${tab}`);

  return (
    <div className={styles.page}>
      <BackButton />
      <LanguageSwitcher />
      <ThemeToggle />

      <header className={styles.header}>
        <div className={styles.headerMain}>
          <div className={styles.titleRow}>
            <PlaneIcon climbing={!isArrival} className={styles.titleIcon} />
            <h1 className={styles.title}>{heading}</h1>
          </div>
          <p className={styles.airport}>{airportName}</p>
        </div>

        <div className={styles.clock}>
          <span className={styles.clockTime}>
            {new Date(now).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className={styles.clockDate}>
            {new Date(now).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </header>

      {refreshedAt && !isPending && (
        <p className={`${styles.freshness} ${isStale ? styles.freshnessStale : ''}`}>
          <span className={styles.freshnessDot} aria-hidden="true" />
          {isStale
            ? t('flights.stale_ago',   { min: ageMin })
            : ageMin < 1
              ? t('flights.updated_now')
              : t('flights.updated_ago', { min: ageMin })}
        </p>
      )}

      {airports?.length > 1 && (
        <div className={styles.airportSelector} role="tablist" aria-label={t('flights.airport')}>
          {airports.map(ap => (
            <button
              key={ap.code}
              role="tab"
              aria-selected={selectedAirport === ap.code}
              className={`${styles.airportTab} ${selectedAirport === ap.code ? styles.airportTabActive : ''}`}
              onClick={() => { setSelectedAirport(ap.code); setSubmitted(''); setSearch(''); setSuggestOpen(false); }}
            >
              <span className={styles.airportCode}>{ap.code}</span>
              <span className={styles.airportLabel}>{ap.label}</span>
            </button>
          ))}
        </div>
      )}

      {!isSearch && (
        <div className={styles.tabs} role="tablist" aria-label={t('flights.title')}>
          {['arrivals', 'departures'].map(type => (
            <button
              key={type}
              role="tab"
              aria-selected={tab === type}
              className={`${styles.tab} ${tab === type ? styles.activeTab : ''}`}
              onClick={() => setTab(type)}
            >
              <PlaneIcon climbing={type === 'departures'} className={styles.tabIcon} />
              {t(`flights.${type}`)}
            </button>
          ))}
        </div>
      )}

      <form className={styles.searchBar} onSubmit={handleSearch} ref={searchBarRef}>
        <label className={styles.searchLabel} htmlFor="flight-search">
          {t('flights.search_label')}
        </label>
        <div className={styles.searchControls}>
          <input
            id="flight-search"
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value.toUpperCase()); setSuggestOpen(true); setActiveIndex(-1); }}
            onFocus={() => { if (search.trim().length >= SUGGEST_MIN_CHARS) setSuggestOpen(true); }}
            onKeyDown={handleSearchKeyDown}
            placeholder={t('flights.search_placeholder')}
            className={styles.searchInput}
            maxLength={40}
            autoComplete="off"
            role="combobox"
            aria-expanded={showSuggestions}
            aria-controls="flight-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `flight-suggestion-${activeIndex}` : undefined}
          />
          <button type="submit" className={styles.searchBtn} disabled={!search.trim()}>
            {t('flights.search')}
          </button>
          {isSearch && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={clearSearch}
              aria-label={t('flights.clear_search')}
            >
              ✕
            </button>
          )}
        </div>

        {showSuggestions && (
          <ul id="flight-suggestions" className={styles.suggestions} role="listbox" aria-label={t('flights.search_label')}>
            {suggestData.loading && suggestions.length === 0 && (
              <li className={styles.suggestionLoading} aria-disabled="true">…</li>
            )}
            {suggestions.map((f, i) => (
              <li key={`${f.flight_number}-${f.departure?.iata}-${f.arrival?.iata}`}>
                <button
                  type="button"
                  id={`flight-suggestion-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`${styles.suggestionItem} ${i === activeIndex ? styles.suggestionItemActive : ''}`}
                  onClick={() => selectSuggestion(f)}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className={styles.suggestionFlight}>{f.flight_number}</span>
                  <span className={styles.suggestionAirline}>{f.airline}</span>
                  <span className={styles.suggestionRoute}>
                    {placeName(f.departure?.airport, f.departure?.iata)} → {placeName(f.arrival?.airport, f.arrival?.iata)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      {!isSearch && !loading && !error && rows.length > 0 && (
        <div className={styles.columns} aria-hidden="true">
          <span>{t('flights.time')}</span>
          <span>{t('flights.flight')}</span>
          <span>{isArrival ? t('flights.origin') : t('flights.destination')}</span>
          <span className={styles.colStatus}>{t('flights.status_col')}</span>
        </div>
      )}

      <div className={styles.flightList} role="list">
        {loading && <div className={styles.center}><div className="spinner" /></div>}

        {!loading && isPending && (
          <div className={styles.empty}>{t('flights.pending')}</div>
        )}

        {!loading && !isPending && !error && rows.length === 0 && (
          <div className={styles.empty}>{t('flights.no_results')}</div>
        )}

        {!loading && !error && rows.map(row =>
          row.kind === 'divider' ? (
            <div key={row.id} className={styles.dayDivider} role="separator">
              <span className={styles.dayLabel}>{row.label}</span>
              <span className={styles.dayRule} />
            </div>
          ) : isSearch ? (
            <RouteCard
              key={row.id}
              flight={row.flight}
              fallbackCode={selectedAirport}
              fallbackName={airportName}
              fmtTime={fmtTime}
              t={t}
            />
          ) : (
            <FlightRow
              key={row.id}
              flight={row.flight}
              isArrival={isArrival}
              fmtTime={fmtTime}
              t={t}
            />
          )
        )}

        {!loading && error && (
          <div className={`${styles.empty} ${styles.emptyError}`}>{t('flights.error')}</div>
        )}
      </div>

      {!isSearch && !loading && !error && flights.length > 0 && (
        <footer className={styles.footer}>
          <span>{t('flights.total', { n: flights.length })}</span>
          <span>{t('flights.local_times')}</span>
        </footer>
      )}
    </div>
  );
}

const PILL_CLASS = {
  scheduled: 'pillScheduled',
  active:    'pillActive',
  landed:    'pillLanded',
  cancelled: 'pillCancelled',
  delayed:   'pillDelayed',
  diverted:  'pillDelayed',
};

function StatusPill({ status, t }) {
  const variant = styles[PILL_CLASS[status] ?? 'pillScheduled'];
  return (
    <span className={`${styles.pill} ${variant}`}>
      {t(`flights.status.${status}`)}
    </span>
  );
}

function FlightRow({ flight, isArrival, fmtTime, t }) {
  // La source ne renseigne jamais le côté de l'aéroport interrogé :
  // on n'affiche donc que l'autre extrémité du trajet.
  const side  = isArrival ? flight.arrival  : flight.departure;
  const other = isArrival ? flight.departure : flight.arrival;
  const delay = side?.delay || 0;
  const status = delay > 0 ? 'delayed' : flight.status;

  const scheduled = fmtTime(side?.scheduled);
  const revised   = side?.actual || side?.estimated;
  const showRevised = revised && fmtTime(revised) !== scheduled;

  const meta = [
    other?.iata,
    other?.terminal && `${t('flights.terminal')} ${other.terminal}`,
    side?.gate      && `${t('flights.gate')} ${side.gate}`,
  ].filter(Boolean).join(' · ');

  return (
    <article className={styles.flightRow} role="listitem">
      <div className={styles.cellTime}>
        <span className={`${styles.time} ${showRevised ? styles.timeSuperseded : ''}`}>
          {scheduled}
        </span>
        {showRevised && <span className={styles.timeRevised}>{fmtTime(revised)}</span>}
      </div>

      <div className={styles.cellFlight}>
        <span className={styles.flightNumRow}>
          {flight.airline_icao && (
            <img
              src={`/airlines/${flight.airline_icao}.png`}
              alt=""
              className={styles.airlineLogo}
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <span className={styles.flightNum}>{flight.flight_number}</span>
        </span>
        <span className={styles.airline}>{flight.airline}</span>
      </div>

      <div className={styles.cellPlace}>
        <span className={styles.place}>{placeName(other?.airport, other?.iata)}</span>
        {meta && <span className={styles.placeMeta}>{meta}</span>}
      </div>

      <div className={styles.cellStatus}>
        <StatusPill status={status} t={t} />
        {delay > 0 && (
          <span className={styles.delayBadge}>+{delay} {t('flights.delay_min')}</span>
        )}
      </div>
    </article>
  );
}

function RouteCard({ flight, fallbackCode, fallbackName, fmtTime, t }) {
  // En recherche, on complète soi-même le côté laissé vide par la source
  const dep = {
    iata:    flight.departure?.iata    || fallbackCode || '',
    airport: flight.departure?.airport || fallbackName || '',
    time:    flight.departure?.actual || flight.departure?.estimated || flight.departure?.scheduled,
    gate:    flight.departure?.gate,
    terminal: flight.departure?.terminal,
  };
  const arr = {
    iata:    flight.arrival?.iata    || fallbackCode || '',
    airport: flight.arrival?.airport || fallbackName || '',
    time:    flight.arrival?.actual || flight.arrival?.estimated || flight.arrival?.scheduled,
    gate:    flight.arrival?.gate,
    terminal: flight.arrival?.terminal,
  };

  const detail = [
    flight.airline,
    dep.gate      && `${t('flights.gate')} ${dep.gate}`,
    arr.terminal  && `${t('flights.terminal')} ${arr.terminal}`,
  ].filter(Boolean).join(' · ');

  return (
    <article className={styles.routeCard} role="listitem">
      <div className={styles.routeHead}>
        <span className={styles.routeFlight}>
          {flight.flight_number} · {flight.airline}
        </span>
        <StatusPill status={flight.status} t={t} />
      </div>

      <div className={styles.routeBody}>
        <div className={styles.routeSide}>
          <span className={styles.routeIata}>{dep.iata}</span>
          <span className={styles.routeTime}>{fmtTime(dep.time)}</span>
          <span className={styles.routePlace}>{placeName(dep.airport, dep.iata)}</span>
        </div>

        <div className={styles.routeLink} aria-hidden="true">
          <span className={styles.routeDot} />
          <span className={styles.routeRule} />
          <PlaneIcon climbing className={styles.routeIcon} />
          <span className={styles.routeRule} />
          <span className={`${styles.routeDot} ${styles.routeDotFilled}`} />
        </div>

        <div className={`${styles.routeSide} ${styles.routeSideEnd}`}>
          <span className={styles.routeIata}>{arr.iata}</span>
          <span className={styles.routeTime}>{fmtTime(arr.time)}</span>
          <span className={styles.routePlace}>{placeName(arr.airport, arr.iata)}</span>
        </div>
      </div>

      {detail && <p className={styles.routeDetail}>{detail}</p>}
    </article>
  );
}
