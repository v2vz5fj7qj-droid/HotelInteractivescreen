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

export default function SuperEventsManager() {
  const { user }   = useAuth();
  const [events,   setEvents]   = useState([]);
  const [filter,   setFilter]   = useState('all');
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const { data } = await axios.get('/api/admin/super/events', { headers, params });
      setEvents(data);
    } finally { setLoading(false); }
  }, [filter]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const publish = async (id) => {
    try {
      await axios.post(`/api/admin/super/events/${id}/publish`, {}, { headers });
      showToast('Événement publié'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const reject = async (id) => {
    const reason = window.prompt('Motif du rejet :');
    if (reason == null) return;
    try {
      await axios.post(`/api/admin/super/events/${id}/reject`, { reason }, { headers });
      showToast('Événement rejeté'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const archive = async (id) => {
    try {
      await axios.post(`/api/admin/super/events/${id}/archive`, {}, { headers });
      showToast('Événement archivé'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const del = async (id, title) => {
    if (!window.confirm(`Supprimer "${title}" ?`)) return;
    try {
      await axios.delete(`/api/admin/super/events/${id}`, { headers });
      showToast('Événement supprimé'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const FILTERS = ['all', 'pending', 'pre_approved', 'published', 'rejected', 'archived'];

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Agenda</h1>
          <p className={styles.managerSub}>Validation et gestion de tous les événements</p>
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
            <tr><th>Titre</th><th>Date</th><th>Hôtel</th><th>Soumis par</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: '24px' }}>Chargement…</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>🗓️</div><div className={styles.emptyText}>Aucun événement</div></div></td></tr>
            ) : events.map(ev => {
              const st = STATUS_STYLE[ev.status] || STATUS_STYLE.pending;
              return (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 600 }}>{ev.title || ev.slug}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>
                    {ev.start_date ? new Date(ev.start_date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{ev.hotel_nom || 'Global'}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{ev.created_by_email || '—'}</td>
                  <td><span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  <td>
                    <div className={styles.tdActions}>
                      {(ev.status === 'pending' || ev.status === 'pre_approved') && (
                        <>
                          <button className={styles.btnPrimary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => publish(ev.id)}>Publier</button>
                          <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => reject(ev.id)}>Rejeter</button>
                        </>
                      )}
                      {ev.status === 'published' && (
                        <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => archive(ev.id)}>Archiver</button>
                      )}
                      <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => del(ev.id, ev.title || ev.slug)}>Supprimer</button>
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
