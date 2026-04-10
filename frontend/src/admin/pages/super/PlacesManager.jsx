import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const STATUS_STYLE = {
  pending:      { bg: '#FEF3C7', color: '#92400E', label: 'En attente' },
  pre_approved: { bg: '#DBEAFE', color: '#1E40AF', label: 'Pré-approuvé' },
  published:    { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:     { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
  archived:     { bg: '#F3F4F6', color: '#6B7280', label: 'Archivé' },
};

export default function PlacesManager() {
  const { user }  = useAuth();
  const [places,  setPlaces]  = useState([]);
  const [filter,  setFilter]  = useState('all');
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const { data } = await axios.get('/api/admin/super/places', { headers, params });
      setPlaces(data);
    } finally { setLoading(false); }
  }, [filter]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const publish = async (id) => {
    try {
      await axios.post(`/api/admin/super/places/${id}/publish`, {}, { headers });
      showToast('Lieu publié'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const reject = async (id) => {
    const reason = window.prompt('Motif du rejet :');
    if (reason == null) return;
    try {
      await axios.post(`/api/admin/super/places/${id}/reject`, { reason }, { headers });
      showToast('Lieu rejeté'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const del = async (id, name) => {
    if (!window.confirm(`Supprimer "${name}" ?`)) return;
    try {
      await axios.delete(`/api/admin/super/places/${id}`, { headers });
      showToast('Lieu supprimé'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const FILTERS = ['all', 'pending', 'published', 'rejected', 'archived'];

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Carte & Lieux</h1>
          <p className={styles.managerSub}>Validation et gestion des points d'intérêt</p>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Filtres */}
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
            <tr><th>Nom</th><th>Catégorie</th><th>Soumis par</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px' }}>Chargement…</td></tr>
            ) : places.length === 0 ? (
              <tr><td colSpan={5}><div className={styles.empty}><div className={styles.emptyIcon}>🗺️</div><div className={styles.emptyText}>Aucun lieu</div></div></td></tr>
            ) : places.map(p => {
              const st = STATUS_STYLE[p.status] || STATUS_STYLE.pending;
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name || p.slug}</td>
                  <td style={{ color: '#6B7280' }}>{p.category_label || p.category || '—'}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{p.created_by_email || '—'}</td>
                  <td><span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  <td>
                    <div className={styles.tdActions}>
                      {p.status === 'pending' && (
                        <>
                          <button className={styles.btnPrimary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => publish(p.id)}>Publier</button>
                          <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => reject(p.id)}>Rejeter</button>
                        </>
                      )}
                      {p.status === 'published' && (
                        <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => del(p.id, p.name || p.slug)}>Supprimer</button>
                      )}
                      {p.status === 'rejected' && (
                        <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => publish(p.id)}>Re-publier</button>
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
