import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

export default function TokensManager() {
  const { user } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState({ total_tokens: '', alert_threshold: '' });
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = async () => {
    try {
      const { data: d } = await axios.get('/api/admin/super/tokens', { headers });
      setData(d);
      setForm({ total_tokens: d.total_tokens, alert_threshold: d.alert_threshold });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const save = async () => {
    setSaving(true);
    try {
      const { data: d } = await axios.put('/api/admin/super/tokens', {
        total_tokens:    parseInt(form.total_tokens),
        alert_threshold: parseInt(form.alert_threshold),
      }, { headers });
      setData(d);
      showToast('Paramètres mis à jour');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const reset = async () => {
    if (!window.confirm('Remettre le compteur de tokens à zéro ?')) return;
    const { data: d } = await axios.post('/api/admin/super/tokens/reset', {}, { headers });
    setData(d);
    showToast('Compteur remis à zéro');
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  const pct   = data ? Math.round((data.used_tokens / data.total_tokens) * 100) : 0;
  const color = pct > 80 ? '#EF4444' : pct > 60 ? '#D97706' : '#10B981';

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Tokens API — FlightAPI.io</h1>
          <p className={styles.managerSub}>Suivi de la consommation du quota de l'API vols</p>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {data?.alert_triggered && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 24, color: '#991B1B', fontSize: '0.88rem', fontWeight: 600 }}>
          ⚠️ Seuil d'alerte atteint ({data.alert_threshold} tokens restants) — pensez à renouveler votre token.
        </div>
      )}

      {/* Jauge */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color }}>{pct}%</div>
            <div style={{ color: '#6B7280', fontSize: '0.85rem' }}>utilisé</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {data?.used_tokens?.toLocaleString()} / {data?.total_tokens?.toLocaleString()}
            </div>
            <div style={{ color: '#6B7280', fontSize: '0.8rem' }}>tokens consommés / total</div>
          </div>
        </div>
        <div style={{ background: '#F3F4F6', borderRadius: 8, height: 12, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, transition: 'width 0.4s' }} />
        </div>
        <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#6B7280' }}>
          {data?.remaining?.toLocaleString()} tokens restants — seuil d'alerte : {data?.alert_threshold?.toLocaleString()} tokens
        </div>
      </div>

      {/* Paramètres */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Paramètres du quota</h2>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Quota total (tokens/mois)</label>
            <input className={styles.input} type="number" value={form.total_tokens}
              onChange={e => setForm(f => ({ ...f, total_tokens: e.target.value }))} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Seuil d'alerte (tokens restants)</label>
            <input className={styles.input} type="number" value={form.alert_threshold}
              onChange={e => setForm(f => ({ ...f, alert_threshold: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button className={styles.btnDanger} onClick={reset}>
            Remettre le compteur à zéro
          </button>
        </div>
      </div>
    </div>
  );
}
