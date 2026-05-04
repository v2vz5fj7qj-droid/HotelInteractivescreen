import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { trackEvent }   from '../../../services/analytics';
import BackButton       from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../../ThemeToggle/ThemeToggle';
import api              from '../../../services/api';
import { getHotelId }  from '../../../services/hotelStore';
import RatesBoard       from './RatesBoard';
import styles           from './CurrencyConverter.module.css';

/* ── Méta devises ────────────────────────────────────────────── */
const CURRENCY_META = {
  XOF: { flag: '🌍', name: 'Franc CFA (UEMOA)' },
  XAF: { flag: '🌍', name: 'Franc CFA (CEMAC)' },
  EUR: { flag: '🇪🇺', name: 'Euro' },
  USD: { flag: '🇺🇸', name: 'Dollar US' },
  GBP: { flag: '🇬🇧', name: 'Livre Sterling' },
  CHF: { flag: '🇨🇭', name: 'Franc Suisse' },
  JPY: { flag: '🇯🇵', name: 'Yen Japonais' },
  CNY: { flag: '🇨🇳', name: 'Yuan Chinois' },
  CAD: { flag: '🇨🇦', name: 'Dollar Canadien' },
  AUD: { flag: '🇦🇺', name: 'Dollar Australien' },
  MAD: { flag: '🇲🇦', name: 'Dirham Marocain' },
  GHS: { flag: '🇬🇭', name: 'Cedi Ghanéen' },
  NGN: { flag: '🇳🇬', name: 'Naira Nigérian' },
  ZAR: { flag: '🇿🇦', name: 'Rand Sud-Africain' },
  EGP: { flag: '🇪🇬', name: 'Livre Égyptienne' },
  KES: { flag: '🇰🇪', name: 'Shilling Kényan' },
  TND: { flag: '🇹🇳', name: 'Dinar Tunisien' },
  INR: { flag: '🇮🇳', name: 'Roupie Indienne' },
  BRL: { flag: '🇧🇷', name: 'Real Brésilien' },
  AED: { flag: '🇦🇪', name: 'Dirham Émirati' },
  RUB: { flag: '🇷🇺', name: 'Rouble Russe' },
  SAR: { flag: '🇸🇦', name: 'Riyal Saoudien' },
};

function fmt(amount, code) {
  if (amount === null || amount === undefined) return '—';
  const decimals = ['JPY', 'KES', 'NGN', 'IDR'].includes(code) ? 0 : 2;
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(amount);
}

/* ── Clavier numérique tactile ───────────────────────────────── */
const KEYS = ['1','2','3','4','5','6','7','8','9','.','0','⌫'];

function NumPad({ onKey }) {
  return (
    <div className={styles.numpad} role="group" aria-label="Clavier numérique">
      {KEYS.map(k => (
        <button
          key={k}
          className={`${styles.numkey} ${k === '⌫' ? styles.numkeyBack : ''}`}
          onPointerDown={e => { e.preventDefault(); onKey(k); }}
          aria-label={k === '⌫' ? 'Effacer' : k}
        >
          {k}
        </button>
      ))}
    </div>
  );
}

/* ── Calculatrice ────────────────────────────────────────────── */
function Calculator({ t, onBack }) {
  const [config,     setConfig]     = useState(null);
  const [rawInput,   setRawInput]   = useState('');
  const [results,    setResults]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [converting, setConverting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error,      setError]      = useState(null);
  const debounceTimer               = useRef(null);

  useEffect(() => {
    api.get('/currency/config').then(r => {
      setConfig(r.data);
      setLoading(false);
    }).catch(() => {
      setError(t('currency.error_config'));
      setLoading(false);
    });
  }, []); // eslint-disable-line

  const doConvert = useCallback(async (val) => {
    const n = parseFloat(val.replace(',', '.'));
    if (!n || n <= 0) { setResults(null); return; }
    setConverting(true);
    try {
      const r = await api.get('/currency/convert', { params: { amount: n } });
      setResults(r.data.conversions);
      setLastUpdate(r.data.last_update);
    } catch {
      setError(t('currency.error_rates'));
    } finally {
      setConverting(false);
    }
  }, [t]);

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    if (!rawInput || !config) return;
    debounceTimer.current = setTimeout(() => doConvert(rawInput), 400);
    return () => clearTimeout(debounceTimer.current);
  }, [rawInput, config, doConvert]);

  const handleKey = (k) => {
    setRawInput(prev => {
      if (k === '⌫') return prev.slice(0, -1);
      if (k === '.' && prev.includes('.')) return prev;
      if (prev.length >= 12) return prev;
      return prev + k;
    });
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await api.post('/currency/refresh', { hotel_id: getHotelId() });
      if (rawInput) await doConvert(rawInput);
    } catch {
      setError(t('currency.error_refresh'));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <div className={styles.center}><div className="spinner" /></div>;

  if (error && !config) return (
    <div className={styles.center}>
      <p style={{ color: 'var(--c-accent)' }}>⚠️ {error}</p>
    </div>
  );

  const base     = config?.base_currency || 'XOF';
  const baseMeta = CURRENCY_META[base] || { flag: '💱', name: base };
  const amount   = parseFloat(rawInput.replace(',', '.')) || 0;

  return (
    <div className={styles.calcWrap}>
      {/* Bouton retour vers le tableau des taux */}
      <button className={styles.backToBoard} onClick={onBack} aria-label={t('currency.back_to_rates')}>
        ← {t('currency.back_to_rates')}
      </button>

      <div className={styles.body}>
        {/* ── Colonne gauche : saisie ── */}
        <div className={styles.inputCol}>
          <div className={styles.inputCard}>
            <div className={styles.baseLabel}>
              <span className={styles.flag}>{baseMeta.flag}</span>
              <span className={styles.baseName}>{baseMeta.name}</span>
              <span className={styles.baseCode}>{base}</span>
            </div>

            <div className={styles.amountDisplay} aria-live="polite">
              <span className={styles.amountValue}>
                {rawInput || <span className={styles.amountPlaceholder}>0</span>}
              </span>
              <span className={styles.amountCursor} aria-hidden="true" />
            </div>

            {amount > 0 && (
              <p className={styles.amountWords}>{fmt(amount, base)} {base}</p>
            )}
          </div>

          <NumPad onKey={handleKey} />

          <div className={styles.shortcuts}>
            {[1000, 5000, 10000, 50000].map(v => (
              <button
                key={v}
                className={styles.shortcut}
                onPointerDown={e => { e.preventDefault(); setRawInput(String(v)); }}
              >
                {fmt(v, base)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Colonne droite : résultats ── */}
        <div className={styles.resultsCol}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsTitle}>{t('currency.equivalences')}</span>
            <button
              className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpin : ''}`}
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label={t('currency.refresh')}
            >
              <RefreshIcon />
              <span>{t('currency.refresh')}</span>
            </button>
          </div>

          {converting && (
            <div className={styles.resultsLoading}>
              <div className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          )}

          {!converting && !rawInput && (
            <div className={styles.resultsCta}>
              <p>{t('currency.enter_amount')}</p>
            </div>
          )}

          {!converting && results && results.length > 0 && (
            <div className={styles.resultsList}>
              {results.map(({ code, amount: converted }) => {
                const meta = CURRENCY_META[code] || { flag: '💱', name: code };
                return (
                  <div key={code} className={styles.resultRow}>
                    <div className={styles.resultLeft}>
                      <span className={styles.resultFlag}>{meta.flag}</span>
                      <div>
                        <span className={styles.resultCode}>{code}</span>
                        <span className={styles.resultName}>{meta.name}</span>
                      </div>
                    </div>
                    <div className={styles.resultAmount}>
                      <span className={styles.resultValue}>{fmt(converted, code)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!converting && results && results.length === 0 && (
            <div className={styles.resultsCta}>
              <p>{t('currency.no_rates')}</p>
            </div>
          )}

          {lastUpdate && (
            <p className={styles.lastUpdate}>
              {t('currency.last_update')} {new Date(lastUpdate).toLocaleString()}
            </p>
          )}

          {error && <p className={styles.errorMsg}>⚠️ {error}</p>}
        </div>
      </div>
    </div>
  );
}

/* ── Composant racine ────────────────────────────────────────── */
export default function CurrencyConverter() {
  const { t }                         = useLanguage();
  const [view, setView]               = useState('board'); // 'board' | 'calc'

  useEffect(() => { trackEvent('currency', 'open'); }, []);

  return (
    <div className={styles.page}>
      <BackButton />
      <LanguageSwitcher />
      <ThemeToggle />

      <div className={styles.header}>
        <h1 className={styles.title}>
          <span>💱</span>
          {t('currency.title')}
        </h1>
        <p className={styles.subtitle}>
          {view === 'board' ? t('currency.subtitle') : t('currency.calc_subtitle')}
        </p>
      </div>

      {view === 'board' && (
        <RatesBoard onOpenCalculator={() => setView('calc')} />
      )}

      {view === 'calc' && (
        <Calculator t={t} onBack={() => setView('board')} />
      )}
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
