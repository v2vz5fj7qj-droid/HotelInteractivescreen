import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const EMPTY_AIRPORT = {
  code: '', label: '',
  schedule_enabled: true, schedule_mode: 'interval',
  interval_minutes: 30, fixed_hours: '',
};

export default function AirportsManager() {
  const { user }   = useAuth();
  const [airports, setAirports] = useState([]);
  const [hotels,   setHotels]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState(EMPTY_AIRPORT);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');
  const [refreshing, setRefreshing] = useState({});

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    try {
      const [{ data: ap }, { data: h }] = await Promise.all([
        axios.get('/api/admin/super/airports', { headers }),
        axios.get('/api/admin/super/hotels',   { headers }),
      ]);
      setAirports(ap);
      setHotels(h.filter(x => x.is_active));
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY_AIRPORT); setModal('create'); };
  const openEdit   = ap => {
    let fixed_hours = '';
    try { fixed_hours = ap.fixed_hours ? JSON.parse(ap.fixed_hours).join(',') : ''; } catch { fixed_hours = ''; }
    setForm({
      code: ap.code, label: ap.label,
      schedule_enabled: !!ap.schedule_enabled, schedule_mode: ap.schedule_mode || 'interval',
      interval_minutes: ap.interval_minutes || 30, fixed_hours,
    });
    setModal(ap);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        label: form.label,
        schedule_enabled: form.schedule_enabled,
        schedule_mode:    form.schedule_mode,
        interval_minutes: parseInt(form.interval_minutes) || 30,
        fixed_hours: form.schedule_mode === 'fixed_hours'
          ? form.fixed_hours.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h))
          : null,
      };
      if (modal === 'create') {
        await axios.post('/api/admin/super/airports', { ...body, code: form.code.toUpperCase() }, { headers });
        showToast('Aéroport créé');
      } else {
        await axios.put(`/api/admin/super/airports/${modal.code}`, body, { headers });
        showToast('Aéroport mis à jour');
      }
      setModal(null); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const del = async (code) => {
    if (!window.confirm(`Supprimer l'aéroport ${code} ?`)) return;
    try {
      await axios.delete(`/api/admin/super/airports/${code}`, { headers });
      showToast('Aéroport supprimé'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const refresh = async (code) => {
    setRefreshing(r => ({ ...r, [code]: true }));
    try {
      await axios.post(`/api/admin/super/airports/${code}/refresh`, {}, { headers });
      showToast(`Vols rafraîchis pour ${code}`);
      load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur refresh'); }
    finally { setRefreshing(r => ({ ...r, [code]: false })); }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Aéroports</h1>
          <p className={styles.managerSub}>Planification des rafraîchissements de vols par aéroport</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Ajouter un aéroport</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Code</th><th>Label</th><th>Planification</th><th>Cron</th><th>Dernier refresh</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {airports.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>✈️</div><div className={styles.emptyText}>Aucun aéroport</div></div></td></tr>
            ) : airports.map(ap => (
              <tr key={ap.code}>
                <td><strong>{ap.code}</strong></td>
                <td>{ap.label}</td>
                <td>
                  {ap.schedule_enabled
                    ? <span className={`${styles.badge} ${styles.badgeActive}`}>
                        {ap.schedule_mode === 'interval' ? `Toutes les ${ap.interval_minutes} min` : 'Heures fixes'}
                      </span>
                    : <span className={`${styles.badge} ${styles.badgeInactive}`}>Manuel</span>
                  }
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#6B7280' }}>
                  {ap.cron_expression || '—'}
                </td>
                <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>
                  {ap.last_fetched_at ? new Date(ap.last_fetched_at).toLocaleString('fr-FR') : '—'}
                </td>
                <td>
                  <div className={styles.tdActions}>
                    <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(ap)}>Modifier</button>
                    <button className={styles.btnPrimary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => refresh(ap.code)} disabled={refreshing[ap.code]}>
                      {refreshing[ap.code] ? '…' : '↻ Refresh'}
                    </button>
                    <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => del(ap.code)}>Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hôtels associés par aéroport */}
      {airports.some(ap => ap.hotels?.length > 0) && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12 }}>Affectations hôtels</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {airports.filter(ap => ap.hotels?.length > 0).map(ap => (
              <div key={ap.code} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 16px' }}>
                <strong>{ap.code}</strong> —{' '}
                {ap.hotels.map(h => h.nom).join(', ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal création/édition */}
      {modal !== null && (
        <div className={styles.modalBackdrop} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouvel aéroport' : `Modifier — ${modal.code}`}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Code IATA *</label>
                  <input className={styles.input} value={form.code} disabled={modal !== 'create'}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="ex: DKR" maxLength={4} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Label *</label>
                  <input className={styles.input} value={form.label}
                    onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Planification automatique</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input type="radio" checked={form.schedule_enabled} onChange={() => setForm(f => ({ ...f, schedule_enabled: true }))} />
                    Activée
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input type="radio" checked={!form.schedule_enabled} onChange={() => setForm(f => ({ ...f, schedule_enabled: false }))} />
                    Désactivée (manuel uniquement)
                  </label>
                </div>
              </div>

              {form.schedule_enabled && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Mode</label>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                      {[['interval', 'Intervalle (toutes les N min)'], ['fixed_hours', 'Heures fixes']].map(([v, l]) => (
                        <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.88rem' }}>
                          <input type="radio" checked={form.schedule_mode === v}
                            onChange={() => setForm(f => ({ ...f, schedule_mode: v }))} />
                          {l}
                        </label>
                      ))}
                    </div>
                  </div>
                  {form.schedule_mode === 'interval' ? (
                    <div className={styles.field}>
                      <label className={styles.label}>Intervalle (minutes)</label>
                      <input className={styles.input} type="number" min={5} value={form.interval_minutes}
                        onChange={e => setForm(f => ({ ...f, interval_minutes: e.target.value }))} />
                    </div>
                  ) : (
                    <div className={styles.field}>
                      <label className={styles.label}>Heures fixes (ex: 6,12,18)</label>
                      <input className={styles.input} value={form.fixed_hours}
                        onChange={e => setForm(f => ({ ...f, fixed_hours: e.target.value }))}
                        placeholder="6,12,18" />
                    </div>
                  )}
                </>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save}
                disabled={saving || !form.label || (modal === 'create' && !form.code)}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
