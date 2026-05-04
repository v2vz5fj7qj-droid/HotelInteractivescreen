import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperHotelId } from '../../components/SuperHotelSelector';
import styles from '../../Admin.module.css';

/* ── Liste de toutes les devises supportées ──────────────────── */
const ALL_CURRENCIES = [
  { code: 'XOF', label: 'XOF — Franc CFA (UEMOA)',    flag: '🌍' },
  { code: 'XAF', label: 'XAF — Franc CFA (CEMAC)',    flag: '🌍' },
  { code: 'EUR', label: 'EUR — Euro',                  flag: '🇪🇺' },
  { code: 'USD', label: 'USD — Dollar US',             flag: '🇺🇸' },
  { code: 'GBP', label: 'GBP — Livre Sterling',        flag: '🇬🇧' },
  { code: 'CHF', label: 'CHF — Franc Suisse',          flag: '🇨🇭' },
  { code: 'JPY', label: 'JPY — Yen Japonais',          flag: '🇯🇵' },
  { code: 'CNY', label: 'CNY — Yuan Chinois',          flag: '🇨🇳' },
  { code: 'CAD', label: 'CAD — Dollar Canadien',       flag: '🇨🇦' },
  { code: 'AUD', label: 'AUD — Dollar Australien',     flag: '🇦🇺' },
  { code: 'MAD', label: 'MAD — Dirham Marocain',       flag: '🇲🇦' },
  { code: 'GHS', label: 'GHS — Cedi Ghanéen',          flag: '🇬🇭' },
  { code: 'NGN', label: 'NGN — Naira Nigérian',        flag: '🇳🇬' },
  { code: 'ZAR', label: 'ZAR — Rand Sud-Africain',    flag: '🇿🇦' },
  { code: 'EGP', label: 'EGP — Livre Égyptienne',      flag: '🇪🇬' },
  { code: 'KES', label: 'KES — Shilling Kényan',       flag: '🇰🇪' },
  { code: 'TND', label: 'TND — Dinar Tunisien',        flag: '🇹🇳' },
  { code: 'INR', label: 'INR — Roupie Indienne',       flag: '🇮🇳' },
  { code: 'BRL', label: 'BRL — Real Brésilien',        flag: '🇧🇷' },
  { code: 'AED', label: 'AED — Dirham Émirati',        flag: '🇦🇪' },
  { code: 'RUB', label: 'RUB — Rouble Russe',          flag: '🇷🇺' },
  { code: 'SAR', label: 'SAR — Riyal Saoudien',        flag: '🇸🇦' },
];

const DEFAULT_FORM = {
  base_currency:        'XOF',
  target_currencies:    ['EUR', 'USD', 'GBP', 'CNY'],
  display_currencies:   ['EUR', 'USD', 'GBP', 'CNY'],
  update_mode:          'auto',
  update_interval_hours: 6,
  daily_update_times:   [],
  api_provider:         'open.er-api.com',
  api_key:              '',
};

export default function DeviseManager() {
  const { user }  = useAuth();
  const hotelId   = useSuperHotelId(user);
  const params    = hotelId ? { hotel_id: hotelId } : {};

  const [form,       setForm]       = useState(DEFAULT_FORM);
  const [rates,      setRates]      = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast,      setToast]      = useState('');
  const [newTime,    setNewTime]    = useState('09:00');

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(''), 3000);
  };

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/hotel/devise', { params });
      setForm({
        base_currency:         data.base_currency        || 'XOF',
        target_currencies:     Array.isArray(data.target_currencies)  ? data.target_currencies  : ['EUR','USD'],
        display_currencies:    Array.isArray(data.display_currencies) ? data.display_currencies : [],
        update_mode:           data.update_mode          || 'auto',
        update_interval_hours: data.update_interval_hours || 6,
        daily_update_times:    Array.isArray(data.daily_update_times) ? data.daily_update_times : [],
        api_provider:          data.api_provider         || 'open.er-api.com',
        api_key:               data.api_key              || '',
      });
      setRates(data.rates);
      setLastUpdate(data.last_update);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await api.put('/hotel/devise', {
        ...form,
        update_interval_hours: parseInt(form.update_interval_hours) || 6,
        daily_update_times:    form.daily_update_times.length > 0 ? form.daily_update_times : null,
        display_currencies:    form.display_currencies.length > 0  ? form.display_currencies  : null,
        api_key:               form.api_key || null,
      }, { params });
      showToast('✅ Configuration sauvegardée');
      load();
    } catch (e) {
      showToast('❌ ' + (e.response?.data?.error || 'Erreur sauvegarde'), false);
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const { data } = await api.post('/hotel/devise/refresh', {}, { params });
      setLastUpdate(data.last_update);
      showToast('✅ Taux actualisés avec succès');
      load();
    } catch (e) {
      showToast('❌ ' + (e.response?.data?.error || 'Erreur de récupération des taux'), false);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleDisplay = (code) => {
    setForm(f => {
      const current = f.display_currencies;
      if (current.includes(code)) {
        return { ...f, display_currencies: current.filter(c => c !== code) };
      }
      if (current.length >= 5) {
        showToast('❌ Maximum 5 devises pour le tableau des taux', false);
        return f;
      }
      return { ...f, display_currencies: [...current, code] };
    });
  };

  const toggleTarget = (code) => {
    setForm(f => {
      const current = f.target_currencies;
      if (current.includes(code)) {
        if (current.length <= 1) return f;
        return { ...f, target_currencies: current.filter(c => c !== code) };
      }
      if (current.length >= 10) {
        showToast('❌ Maximum 10 devises cibles', false);
        return f;
      }
      return { ...f, target_currencies: [...current, code] };
    });
  };

  const addDailyTime = () => {
    if (form.daily_update_times.includes(newTime)) return;
    setForm(f => ({ ...f, daily_update_times: [...f.daily_update_times, newTime].sort() }));
  };

  const removeDailyTime = (t) => {
    setForm(f => ({ ...f, daily_update_times: f.daily_update_times.filter(x => x !== t) }));
  };

  if (loading) return (
    <div className={styles.managerPage}>
      <div className={styles.center}><div className="spinner" /></div>
    </div>
  );

  const availableTargets = ALL_CURRENCIES.filter(c => c.code !== form.base_currency);

  return (
    <div className={styles.managerPage}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>💱 Convertisseur de devises</h1>
        <p className={styles.pageSubtitle}>
          Configuration du module de conversion affiché sur la borne.
        </p>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.ok === false ? styles.toastError : ''}`}>
          {toast.msg}
        </div>
      )}

      <div className={styles.formGrid}>

        {/* ── Section 1 : Devise de base ── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Devise de base</h2>
          <p className={styles.cardDesc}>
            Le client saisit un montant dans cette devise.
          </p>
          <select
            className={styles.select}
            value={form.base_currency}
            onChange={e => setForm(f => ({ ...f, base_currency: e.target.value }))}
          >
            {ALL_CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.label}
              </option>
            ))}
          </select>
        </section>

        {/* ── Section 2 : Devises cibles ── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            Devises cibles
            <span className={styles.badge}>{form.target_currencies.length} / 10</span>
          </h2>
          <p className={styles.cardDesc}>
            Les devises converties affichées sur la borne (max 10).
          </p>

          {/* Devises sélectionnées */}
          <div className={styles.tagList}>
            {form.target_currencies.map(code => {
              const meta = ALL_CURRENCIES.find(c => c.code === code);
              return (
                <span key={code} className={styles.tag}>
                  {meta?.flag} {code}
                  <button
                    className={styles.tagRemove}
                    onClick={() => toggleTarget(code)}
                    aria-label={`Retirer ${code}`}
                  >×</button>
                </span>
              );
            })}
          </div>

          {/* Grille de sélection */}
          <div className={styles.currencyGrid}>
            {availableTargets.map(c => {
              const selected = form.target_currencies.includes(c.code);
              return (
                <button
                  key={c.code}
                  className={`${styles.currencyBtn} ${selected ? styles.currencyBtnActive : ''}`}
                  onClick={() => toggleTarget(c.code)}
                  disabled={!selected && form.target_currencies.length >= 10}
                >
                  <span>{c.flag}</span>
                  <span className={styles.currencyCode}>{c.code}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Section 2b : Devises du tableau des taux ── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            Tableau des taux — devises affichées
            <span className={styles.badge}>{form.display_currencies.length} / 5</span>
          </h2>
          <p className={styles.cardDesc}>
            Sélectionnez jusqu'à <strong>5</strong> devises (parmi vos cibles) qui apparaîtront
            sur l'écran d'accueil du convertisseur. La devise de base est toujours incluse.
            Toutes les combinaisons croisées seront affichées (max&nbsp;15 paires).
          </p>

          {form.target_currencies.length === 0 ? (
            <p className={styles.mutedText}>Ajoutez d'abord des devises cibles ci-dessus.</p>
          ) : (
            <>
              <div className={styles.tagList}>
                {form.display_currencies.map(code => {
                  const meta = ALL_CURRENCIES.find(c => c.code === code);
                  return (
                    <span key={code} className={styles.tag}>
                      {meta?.flag} {code}
                      <button className={styles.tagRemove} onClick={() => toggleDisplay(code)}>×</button>
                    </span>
                  );
                })}
                {form.display_currencies.length === 0 && (
                  <span className={styles.mutedText}>
                    Aucune sélectionnée — les 5 premières cibles seront utilisées par défaut.
                  </span>
                )}
              </div>

              <div className={styles.currencyGrid}>
                {form.target_currencies.filter(c => c !== form.base_currency).map(code => {
                  const meta     = ALL_CURRENCIES.find(c => c.code === code);
                  const selected = form.display_currencies.includes(code);
                  return (
                    <button
                      key={code}
                      className={`${styles.currencyBtn} ${selected ? styles.currencyBtnActive : ''}`}
                      onClick={() => toggleDisplay(code)}
                      disabled={!selected && form.display_currencies.length >= 5}
                    >
                      <span>{meta?.flag || '💱'}</span>
                      <span className={styles.currencyCode}>{code}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* ── Section 3 : Mode de mise à jour ── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Mise à jour des taux</h2>

          <div className={styles.radioGroup}>
            {[
              { value: 'auto',   label: '⚙️ Automatique', desc: 'Mise à jour selon un intervalle ou des heures définies' },
              { value: 'manual', label: '✋ Manuel',       desc: 'Mise à jour uniquement via le bouton ci-dessous' },
            ].map(opt => (
              <label key={opt.value} className={`${styles.radioCard} ${form.update_mode === opt.value ? styles.radioCardActive : ''}`}>
                <input
                  type="radio"
                  name="update_mode"
                  value={opt.value}
                  checked={form.update_mode === opt.value}
                  onChange={() => setForm(f => ({ ...f, update_mode: opt.value }))}
                  className={styles.radioInput}
                />
                <div>
                  <strong>{opt.label}</strong>
                  <p className={styles.radioDesc}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {form.update_mode === 'auto' && (
            <div className={styles.autoConfig}>
              <div className={styles.formRow}>
                <label className={styles.label}>
                  Intervalle (heures)
                  <input
                    type="number"
                    className={styles.input}
                    min={1} max={24}
                    value={form.update_interval_hours}
                    onChange={e => setForm(f => ({ ...f, update_interval_hours: e.target.value }))}
                    style={{ width: 80 }}
                  />
                </label>
              </div>

              <div className={styles.formRow}>
                <label className={styles.label}>
                  Heures quotidiennes spécifiques (optionnel)
                </label>
                <div className={styles.timeRow}>
                  <input
                    type="time"
                    className={styles.input}
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                  />
                  <button className={styles.btnSecondary} onClick={addDailyTime}>
                    + Ajouter
                  </button>
                </div>
                <div className={styles.tagList} style={{ marginTop: 8 }}>
                  {form.daily_update_times.map(t => (
                    <span key={t} className={styles.tag}>
                      🕐 {t}
                      <button className={styles.tagRemove} onClick={() => removeDailyTime(t)}>×</button>
                    </span>
                  ))}
                  {form.daily_update_times.length === 0 && (
                    <span className={styles.mutedText}>Aucune heure spécifique — l'intervalle s'applique</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bouton refresh manuel */}
          <div className={styles.refreshSection}>
            <div>
              <strong>Mettre à jour maintenant</strong>
              {lastUpdate && (
                <p className={styles.mutedText}>
                  Dernière maj : {new Date(lastUpdate).toLocaleString('fr-FR')}
                </p>
              )}
            </div>
            <button
              className={styles.btnPrimary}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? '⏳ Actualisation…' : '🔄 Actualiser les taux'}
            </button>
          </div>
        </section>

        {/* ── Section 4 : Taux actuels ── */}
        {rates && (
          <section className={styles.card} style={{ gridColumn: '1 / -1' }}>
            <h2 className={styles.cardTitle}>Taux actuels stockés</h2>
            <div className={styles.ratesGrid}>
              {form.target_currencies.map(code => (
                <div key={code} className={styles.rateItem}>
                  <span className={styles.rateCode}>{code}</span>
                  <span className={styles.rateValue}>
                    {rates[code] != null
                      ? Number(rates[code]).toLocaleString('fr-FR', { maximumFractionDigits: 6 })
                      : '—'
                    }
                  </span>
                </div>
              ))}
            </div>
            <p className={styles.mutedText} style={{ marginTop: 8 }}>
              1 {form.base_currency} = x devise cible
            </p>
          </section>
        )}

      </div>

      {/* ── Actions ── */}
      <div className={styles.actions}>
        <button
          className={styles.btnPrimary}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '⏳ Sauvegarde…' : '💾 Sauvegarder la configuration'}
        </button>
      </div>
    </div>
  );
}
