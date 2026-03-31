import React, { useState, useEffect, useCallback } from 'react';
import api    from '../useAdminApi';
import styles from '../Admin.module.css';

const INTERVALS = [
  { value: 1,    label: '1 minute'    },
  { value: 2,    label: '2 minutes'   },
  { value: 5,    label: '5 minutes'   },
  { value: 10,   label: '10 minutes'  },
  { value: 15,   label: '15 minutes'  },
  { value: 30,   label: '30 minutes'  },
  { value: 60,   label: '1 heure'     },
  { value: 120,  label: '2 heures'    },
  { value: 240,  label: '4 heures'    },
  { value: 360,  label: '6 heures'    },
  { value: 720,  label: '12 heures'   },
  { value: 1440, label: '24 heures'   },
];

const PLANS = [
  { label: 'Free trial (30 crédits)',  value: 30     },
  { label: 'Lite (30 000 crédits)',    value: 30000  },
  { label: 'Standard (100 000 crédits)', value: 100000 },
  { label: 'Plus (500 000 crédits)',   value: 500000 },
];

const TIMEZONES = [
  { value: 'Africa/Abidjan',       label: 'Abidjan / Dakar / Ouagadougou (UTC+0)' },
  { value: 'Africa/Lagos',         label: 'Lagos / Douala / Libreville (UTC+1)' },
  { value: 'Africa/Cairo',         label: 'Le Caire / Khartoum (UTC+2)' },
  { value: 'Africa/Johannesburg',  label: 'Johannesburg / Harare (UTC+2)' },
  { value: 'Africa/Nairobi',       label: 'Nairobi / Addis-Abeba (UTC+3)' },
  { value: 'Europe/London',        label: 'Londres (UTC+0/+1)' },
  { value: 'Europe/Paris',         label: 'Paris / Bruxelles (UTC+1/+2)' },
  { value: 'Europe/Moscow',        label: 'Moscou (UTC+3)' },
  { value: 'Asia/Dubai',           label: 'Dubaï (UTC+4)' },
  { value: 'Asia/Kolkata',         label: 'New Delhi (UTC+5:30)' },
  { value: 'Asia/Singapore',       label: 'Singapour / Hong Kong (UTC+8)' },
  { value: 'Asia/Tokyo',           label: 'Tokyo (UTC+9)' },
  { value: 'America/New_York',     label: 'New York (UTC-5/-4)' },
  { value: 'America/Chicago',      label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Los_Angeles',  label: 'Los Angeles (UTC-8/-7)' },
  { value: 'UTC',                  label: 'UTC (référence universelle)' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const DEFAULT_CONFIG  = { airport_iata: 'OUA', refresh_interval: 5, auto_refresh: false, refresh_mode: 'interval', schedule_times: [], timezone: 'Africa/Abidjan' };
const DEFAULT_CREDITS = { used: 0, limit: 30000, remaining: 30000 };

export default function FlightsManager() {
  const [config,      setConfig]      = useState(DEFAULT_CONFIG);
  const [saved,       setSaved]       = useState(DEFAULT_CONFIG);
  const [credits,     setCredits]     = useState(DEFAULT_CREDITS);
  const [saving,      setSaving]      = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [resetting,   setResetting]   = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [msg,         setMsg]         = useState('');
  const [msgType,     setMsgType]     = useState('ok');

  const notify = (text, type = 'ok') => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  };

  const loadConfig = useCallback(() =>
    api.get('/flights/config')
      .then(r => { setConfig(r.data); setSaved(r.data); })
      .catch(() => {}), []);

  const loadCredits = useCallback(() =>
    api.get('/flights/credits')
      .then(r => setCredits(r.data))
      .catch(() => {}), []);

  useEffect(() => { loadConfig(); loadCredits(); }, [loadConfig, loadCredits]);

  const isDirty = JSON.stringify(config) !== JSON.stringify(saved);

  const save = async () => {
    if (!config.airport_iata.trim()) return notify('Code IATA requis', 'err');
    setSaving(true);
    try {
      await api.put('/flights/config', {
        ...config,
        credits_limit: credits.limit,
      });
      setSaved({ ...config });
      notify('Configuration enregistrée — scheduler mis à jour');
    } catch {
      notify('Erreur lors de l\'enregistrement', 'err');
    } finally { setSaving(false); }
  };

  const manualRefresh = async () => {
    setRefreshing(true);
    try {
      const r = await api.post('/flights/refresh');
      setLastRefresh(new Date());
      await loadCredits(); // actualise le compteur
      notify(
        r.data.message
          ? `Rafraîchi (${r.data.message})`
          : `Vols rafraîchis — ${r.data.refreshed}/2 type(s) (${r.data.airport})`
      );
    } catch {
      notify('Erreur lors du rafraîchissement', 'err');
    } finally { setRefreshing(false); }
  };

  const resetCreditsCounter = async () => {
    if (!window.confirm('Remettre le compteur de crédits à zéro ?')) return;
    setResetting(true);
    try {
      await api.post('/flights/credits/reset');
      await loadCredits();
      notify('Compteur remis à zéro');
    } catch {
      notify('Erreur lors de la remise à zéro', 'err');
    } finally { setResetting(false); }
  };

  const pct     = credits.limit > 0 ? Math.min(100, (credits.used / credits.limit) * 100) : 0;
  const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : '#10B981';

  return (
    <div className={styles.managerPage}>
      {/* ── En-tête ── */}
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>✈️ Programme des vols</h1>
          <p className={styles.managerSub}>
            Configurez l'aéroport affiché, la fréquence d'actualisation et suivez votre consommation FlightAPI.
          </p>
        </div>
        <button className={styles.btnSecondary} onClick={manualRefresh} disabled={refreshing}>
          {refreshing ? '⏳ Rafraîchissement…' : '🔄 Rafraîchir maintenant'}
        </button>
      </div>

      {msg && (
        <div className={styles.toast} style={msgType === 'err' ? { background: '#EF4444' } : {}}>
          {msg}
        </div>
      )}

      {/* ── Crédits ── */}
      <div className={styles.settingsCard} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className={styles.settingsCardTitle} style={{ margin: 0 }}>Crédits FlightAPI</h2>
          <button
            className={styles.btnDanger}
            onClick={resetCreditsCounter}
            disabled={resetting}
            style={{ fontSize: '0.78rem', padding: '5px 12px' }}
          >
            {resetting ? '…' : '↺ Remise à zéro'}
          </button>
        </div>

        {/* Compteurs */}
        <div className={styles.statusGrid} style={{ marginBottom: 16 }}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Crédits utilisés</span>
            <strong className={styles.statusValue} style={{ fontSize: '1.6rem', color: barColor }}>
              {credits.used.toLocaleString('fr-FR')}
            </strong>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Crédits restants</span>
            <strong className={styles.statusValue} style={{ fontSize: '1.6rem', color: barColor }}>
              {credits.remaining.toLocaleString('fr-FR')}
            </strong>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Quota du plan</span>
            <strong className={styles.statusValue}>{credits.limit.toLocaleString('fr-FR')}</strong>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Consommation</span>
            <strong className={styles.statusValue} style={{ color: barColor }}>
              {pct.toFixed(1)} %
            </strong>
          </div>
        </div>

        {/* Barre de progression */}
        <div style={{ background: '#E5E7EB', borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{
            width: `${pct}%`, height: '100%',
            background: barColor,
            borderRadius: 99,
            transition: 'width 0.4s ease, background 0.3s',
          }} />
        </div>

        {/* Sélecteur de plan */}
        <div className={styles.settingsRow} style={{ padding: '8px 0 0' }}>
          <div className={styles.settingsRowInfo}>
            <span className={styles.settingsRowLabel}>Plan souscrit</span>
            <span className={styles.settingsRowHint}>Définit le quota maximum affiché</span>
          </div>
          <div className={styles.settingsRowControl}>
            <select
              className={styles.select}
              style={{ width: 260 }}
              value={credits.limit}
              onChange={e => setCredits(p => ({ ...p, limit: +e.target.value, remaining: Math.max(0, +e.target.value - p.used) }))}
            >
              {PLANS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {pct >= 80 && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: pct >= 90 ? '#FEF2F2' : '#FFFBEB', borderRadius: 8, fontSize: '0.82rem', color: pct >= 90 ? '#991B1B' : '#92400E', fontWeight: 600 }}>
            {pct >= 90
              ? '⚠️ Quota presque épuisé — pensez à mettre à niveau votre plan FlightAPI.'
              : '⚡ Vous avez consommé plus de 80 % de votre quota mensuel.'}
          </div>
        )}
      </div>

      {/* ── Paramètres ── */}
      <div className={styles.settingsCard}>
        <h2 className={styles.settingsCardTitle}>Paramètres</h2>

        <div className={styles.settingsRow}>
          <div className={styles.settingsRowInfo}>
            <span className={styles.settingsRowLabel}>Code IATA de l'aéroport</span>
            <span className={styles.settingsRowHint}>Code à 3 lettres (ex: OUA, CDG, JFK)</span>
          </div>
          <div className={styles.settingsRowControl}>
            <input
              className={styles.input}
              style={{ textTransform: 'uppercase', width: 120, letterSpacing: 3, fontWeight: 700 }}
              value={config.airport_iata}
              maxLength={4}
              onChange={e => setConfig(p => ({ ...p, airport_iata: e.target.value.toUpperCase() }))}
              placeholder="OUA"
            />
          </div>
        </div>

        <div className={styles.settingsDivider} />

        {/* Mode d'actualisation */}
        <div className={styles.settingsRow}>
          <div className={styles.settingsRowInfo}>
            <span className={styles.settingsRowLabel}>Mode d'actualisation</span>
            <span className={styles.settingsRowHint}>Intervalle fixe ou heures spécifiques de la journée</span>
          </div>
          <div className={styles.settingsRowControl}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ value: 'interval', label: 'Intervalle fixe' }, { value: 'schedule', label: 'Heures spécifiques' }].map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, refresh_mode: m.value }))}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: '2px solid',
                    borderColor: config.refresh_mode === m.value ? '#3B82F6' : '#D1D5DB',
                    background: config.refresh_mode === m.value ? '#EFF6FF' : 'transparent',
                    color: config.refresh_mode === m.value ? '#1D4ED8' : '#6B7280',
                    fontWeight: config.refresh_mode === m.value ? 700 : 400,
                    cursor: 'pointer', fontSize: '0.85rem',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.settingsDivider} />

        {config.refresh_mode === 'interval' ? (
          <div className={styles.settingsRow}>
            <div className={styles.settingsRowInfo}>
              <span className={styles.settingsRowLabel}>Intervalle d'actualisation</span>
              <span className={styles.settingsRowHint}>
                ~{Math.round((60 / config.refresh_interval) * 2 * 24 * 30).toLocaleString('fr-FR')} crédits/mois
              </span>
            </div>
            <div className={styles.settingsRowControl}>
              <select
                className={styles.select}
                style={{ width: 160 }}
                value={config.refresh_interval}
                onChange={e => setConfig(p => ({ ...p, refresh_interval: +e.target.value }))}
              >
                {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.settingsRow}>
              <div className={styles.settingsRowInfo}>
                <span className={styles.settingsRowLabel}>Fuseau horaire</span>
                <span className={styles.settingsRowHint}>Les heures ci-dessous seront interprétées dans ce fuseau</span>
              </div>
              <div className={styles.settingsRowControl}>
                <select
                  className={styles.select}
                  style={{ width: '100%', maxWidth: 320 }}
                  value={config.timezone}
                  onChange={e => setConfig(p => ({ ...p, timezone: e.target.value }))}
                >
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.settingsDivider} />

            {/* Grille d'heures — layout vertical pleine largeur */}
            <div style={{ padding: '14px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <span className={styles.settingsRowLabel}>Heures d'actualisation</span>
                <span className={styles.settingsRowHint}>
                  {config.schedule_times.length === 0
                    ? 'Aucune heure sélectionnée'
                    : `${config.schedule_times.length} heure(s) · ~${config.schedule_times.length * 2 * 30} crédits/mois`}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 8 }}>
                {HOURS.map(h => {
                  const active = config.schedule_times.includes(h);
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setConfig(p => ({
                        ...p,
                        schedule_times: active
                          ? p.schedule_times.filter(t => t !== h)
                          : [...p.schedule_times, h].sort((a, b) => a - b),
                      }))}
                      style={{
                        height: 38, borderRadius: 8, border: '2px solid',
                        borderColor: active ? '#3B82F6' : '#D1D5DB',
                        background: active ? '#3B82F6' : 'transparent',
                        color: active ? '#fff' : '#6B7280',
                        fontWeight: active ? 700 : 400,
                        cursor: 'pointer', fontSize: '0.82rem',
                      }}
                    >
                      {String(h).padStart(2, '0')}h
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className={styles.settingsDivider} />

        <div className={styles.settingsRow}>
          <div className={styles.settingsRowInfo}>
            <span className={styles.settingsRowLabel}>Actualisation automatique</span>
            <span className={styles.settingsRowHint}>
              Active le scheduler selon le mode configuré ci-dessus
            </span>
          </div>
          <div className={styles.settingsRowControl}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={!!config.auto_refresh}
                onChange={e => setConfig(p => ({ ...p, auto_refresh: e.target.checked }))}
              />
              <span className={styles.toggleSlider} />
            </label>
            <span style={{ marginLeft: 10, fontSize: '0.85rem', color: config.auto_refresh ? '#10B981' : '#9CA3AF', fontWeight: 600 }}>
              {config.auto_refresh ? 'Activée' : 'Désactivée'}
            </span>
          </div>
        </div>

        <div className={styles.settingsFooter}>
          {isDirty && (
            <span style={{ fontSize: '0.8rem', color: '#F59E0B', marginRight: 12 }}>
              ● Modifications non enregistrées
            </span>
          )}
          <button className={styles.btnPrimary} onClick={save} disabled={saving || !isDirty}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* ── Statut scheduler ── */}
      <div className={styles.settingsCard} style={{ marginTop: 16 }}>
        <h2 className={styles.settingsCardTitle}>Statut</h2>
        <div className={styles.statusGrid}>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Aéroport</span>
            <strong className={styles.statusValue}>{saved.airport_iata}</strong>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Mode</span>
            <strong className={styles.statusValue}>
              {saved.refresh_mode === 'schedule' ? 'Heures spécifiques' : 'Intervalle fixe'}
            </strong>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>{saved.refresh_mode === 'schedule' ? 'Heures programmées' : 'Intervalle'}</span>
            <strong className={styles.statusValue}>
              {saved.refresh_mode === 'schedule'
                ? (saved.schedule_times?.length > 0
                    ? saved.schedule_times.map(h => String(h).padStart(2, '0') + 'h').join(', ')
                    : '—')
                : (INTERVALS.find(i => i.value === saved.refresh_interval)?.label || `${saved.refresh_interval} min`)}
            </strong>
          </div>
          {saved.refresh_mode === 'schedule' && (
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>Fuseau horaire</span>
              <strong className={styles.statusValue}>{saved.timezone}</strong>
            </div>
          )}
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Scheduler</span>
            <span className={saved.auto_refresh ? styles.badgeActive : styles.badgeInactive}>
              {saved.auto_refresh ? '▶ Actif' : '■ Arrêté'}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusLabel}>Dernier rafraîchissement manuel</span>
            <strong className={styles.statusValue}>
              {lastRefresh ? lastRefresh.toLocaleTimeString('fr-FR') : '—'}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
