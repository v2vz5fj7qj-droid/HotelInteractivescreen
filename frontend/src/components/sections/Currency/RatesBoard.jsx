import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import api             from '../../../services/api';
import styles          from './RatesBoard.module.css';

/* ── Méta devises ────────────────────────────────────────────── */
const CURRENCY_META = {
  XOF: { flag: '🌍', name: 'Franc CFA' },
  XAF: { flag: '🌍', name: 'Franc CFA' },
  EUR: { flag: '🇪🇺', name: 'Euro' },
  USD: { flag: '🇺🇸', name: 'Dollar' },
  GBP: { flag: '🇬🇧', name: 'Livre' },
  CHF: { flag: '🇨🇭', name: 'Franc CH' },
  JPY: { flag: '🇯🇵', name: 'Yen' },
  CNY: { flag: '🇨🇳', name: 'Yuan' },
  CAD: { flag: '🇨🇦', name: 'Dollar CA' },
  AUD: { flag: '🇦🇺', name: 'Dollar AU' },
  MAD: { flag: '🇲🇦', name: 'Dirham' },
  GHS: { flag: '🇬🇭', name: 'Cedi' },
  NGN: { flag: '🇳🇬', name: 'Naira' },
  ZAR: { flag: '🇿🇦', name: 'Rand' },
  EGP: { flag: '🇪🇬', name: 'Livre EG' },
  KES: { flag: '🇰🇪', name: 'Shilling' },
  TND: { flag: '🇹🇳', name: 'Dinar' },
  INR: { flag: '🇮🇳', name: 'Roupie' },
  BRL: { flag: '🇧🇷', name: 'Real' },
  AED: { flag: '🇦🇪', name: 'Dirham' },
  RUB: { flag: '🇷🇺', name: 'Rouble' },
  SAR: { flag: '🇸🇦', name: 'Riyal' },
};

function fmtRate(rate, toCode) {
  if (rate == null) return '—';
  const noDecimals = ['JPY', 'KES', 'NGN', 'IDR'];
  const manyDecimals = ['XOF', 'XAF'];
  let digits = 4;
  if (noDecimals.includes(toCode))   digits = 0;
  if (manyDecimals.includes(toCode)) digits = 2;
  if (rate >= 100)  digits = 2;
  if (rate >= 1000) digits = 0;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rate);
}

/* ── Composant ───────────────────────────────────────────────── */
export default function RatesBoard({ onOpenCalculator }) {
  const { t }                       = useLanguage();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [lastAnim,   setLastAnim]   = useState(0); // déclencheur re-animation

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const r = await api.get('/currency/rates');
      setData(r.data);
      setLastAnim(Date.now());
      setError(null);
    } catch {
      setError(t('currency.error_rates'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh toutes les 60 s (affichage vivant)
  useEffect(() => {
    const id = setInterval(() => load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return (
    <div className={styles.center}><div className="spinner" /></div>
  );

  if (error && !data) return (
    <div className={styles.center}>
      <p className={styles.errorMsg}>⚠️ {error}</p>
    </div>
  );

  if (!data || data.pairs.length === 0) return (
    <div className={styles.center}>
      <p className={styles.noData}>{t('currency.no_rates')}</p>
    </div>
  );

  const lastUpdate = data.last_update
    ? new Date(data.last_update).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={styles.board}>

      {/* ── En-tête ── */}
      <div className={styles.boardHeader}>
        <div className={styles.boardMeta}>
          <span className={styles.boardTitle}>{t('currency.rates_title')}</span>
          {lastUpdate && (
            <span className={styles.boardTime}>
              <PulseIcon /> {t('currency.last_update')} {lastUpdate}
            </span>
          )}
        </div>

        <div className={styles.boardActions}>
          <button
            className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpin : ''}`}
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label={t('currency.refresh')}
          >
            <RefreshIcon />
          </button>
          <button
            className={styles.calcBtn}
            onClick={onOpenCalculator}
            aria-label={t('currency.open_calculator')}
          >
            <CalcIcon />
            <span>{t('currency.open_calculator')}</span>
          </button>
        </div>
      </div>

      {/* ── Grille des paires ── */}
      <div className={styles.pairsGrid}>
        {data.pairs.map(({ from, to, rate }, idx) => {
          const metaFrom  = CURRENCY_META[from] || { flag: '💱', name: from };
          const metaTo    = CURRENCY_META[to]   || { flag: '💱', name: to };
          const inverseRate = rate > 0 ? 1 / rate : null;
          return (
            <div
              key={`${from}-${to}-${lastAnim}`}
              className={styles.pairCard}
              style={{ '--delay': `${idx * 40}ms` }}
            >
              {/* En-tête : les deux devises */}
              <div className={styles.pairHeader}>
                <div className={styles.pairCur}>
                  <span className={styles.pairFlag}>{metaFrom.flag}</span>
                  <div className={styles.pairInfo}>
                    <span className={styles.pairCode}>{from}</span>
                    <span className={styles.pairName}>{metaFrom.name}</span>
                  </div>
                </div>
                <span className={styles.pairSwapIcon} aria-hidden="true">⇄</span>
                <div className={`${styles.pairCur} ${styles.pairCurRight}`}>
                  <div className={styles.pairInfo}>
                    <span className={styles.pairCode}>{to}</span>
                    <span className={styles.pairName}>{metaTo.name}</span>
                  </div>
                  <span className={styles.pairFlag}>{metaTo.flag}</span>
                </div>
              </div>

              {/* Taux dans les deux sens */}
              <div className={styles.pairRates}>
                <div className={styles.pairRateLine}>
                  <span className={styles.pairRateLabel}>1 {from}</span>
                  <span className={styles.pairRateSep}>→</span>
                  <span className={styles.pairRateVal}>{fmtRate(rate, to)}</span>
                  <span className={styles.pairRateUnit}>{to}</span>
                </div>
                <div className={`${styles.pairRateLine} ${styles.pairRateLineInv}`}>
                  <span className={styles.pairRateLabel}>1 {to}</span>
                  <span className={styles.pairRateSep}>→</span>
                  <span className={styles.pairRateVal}>{fmtRate(inverseRate, from)}</span>
                  <span className={styles.pairRateUnit}>{from}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Icônes inline ───────────────────────────────────────────── */
function RefreshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
function CalcIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="8" y2="10" strokeWidth="3" strokeLinecap="round" />
      <line x1="12" y1="10" x2="12" y2="10" strokeWidth="3" strokeLinecap="round" />
      <line x1="16" y1="10" x2="16" y2="10" strokeWidth="3" strokeLinecap="round" />
      <line x1="8" y1="14" x2="8" y2="14" strokeWidth="3" strokeLinecap="round" />
      <line x1="12" y1="14" x2="12" y2="14" strokeWidth="3" strokeLinecap="round" />
      <line x1="16" y1="14" x2="16" y2="18" />
      <line x1="8" y1="18" x2="8" y2="18" strokeWidth="3" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="18" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function PulseIcon() {
  return <span className={styles.pulse} aria-hidden="true" />;
}
