import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const STATUS_STYLE = {
  pending:   { bg: '#FEF3C7', color: '#92400E', label: 'En attente' },
  published: { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
};

export default function InfoManager() {
  const { user }  = useAuth();
  const [items,   setItems]   = useState([]);
  const [filter,  setFilter]  = useState('all');
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const { data } = await axios.get('/api/admin/super/info', { headers, params });
      setItems(data);
    } finally { setLoading(false); }
  }, [filter]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const publish = async (id) => {
    try {
      await axios.post(`/api/admin/super/info/${id}/publish`, {}, { headers });
      showToast('Info publiée'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const reject = async (id) => {
    const reason = window.prompt('Motif du rejet :');
    if (reason == null) return;
    try {
      await axios.post(`/api/admin/super/info/${id}/reject`, { reason }, { headers });
      showToast('Info rejetée'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const del = async (id, name) => {
    if (!window.confirm(`Supprimer "${name}" ?`)) return;
    try {
      await axios.delete(`/api/admin/super/info/${id}`, { headers });
      showToast('Info supprimée'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const FILTERS = ['all', 'pending', 'published', 'rejected'];

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Infos utiles</h1>
          <p className={styles.managerSub}>Validation et gestion des contacts utiles</p>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid',
              borderColor: filter === f ? '#C2782A' : '#E5E7EB',
              background: filter === f ? '#C2782A' : '#fff',
              color: filter === f ? '#fff' : '#6B7280',
              fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            {f === 'all' ? 'Tous' : STATUS_STYLE[f]?.label || f}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom</th><th>Catégorie</th><th>Téléphone</th><th>Soumis par</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px' }}>Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>📞</div><div className={styles.emptyText}>Aucune info utile</div></div></td></tr>
            ) : items.map(it => {
              const st = STATUS_STYLE[it.status] || STATUS_STYLE.pending;
              return (
                <tr key={it.id}>
                  <td style={{ fontWeight: 600 }}>{it.name || '—'}</td>
                  <td style={{ color: '#6B7280' }}>{it.category || '—'}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{it.phone || it.whatsapp || '—'}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{it.created_by_email || '—'}</td>
                  <td><span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  <td>
                    <div className={styles.tdActions}>
                      {it.status === 'pending' && (
                        <>
                          <button className={styles.btnPrimary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => publish(it.id)}>Publier</button>
                          <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => reject(it.id)}>Rejeter</button>
                        </>
                      )}
                      {it.status !== 'pending' && (
                        <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => del(it.id, it.name)}>Supprimer</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
