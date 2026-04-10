import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import styles from '../../Admin.module.css';

const STATUS_STYLE = {
  pending:      { bg: '#FEF3C7', color: '#92400E', label: 'En attente' },
  pre_approved: { bg: '#DBEAFE', color: '#1E40AF', label: 'Pré-approuvé' },
  published:    { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:     { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
  archived:     { bg: '#F3F4F6', color: '#6B7280', label: 'Archivé' },
};

const FILTERS = ['all', 'pending', 'pre_approved', 'published', 'rejected', 'archived'];
const PER_PAGE = 25;

export default function SuperEventsManager() {
  const [events,   setEvents]   = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [filter,   setFilter]   = useState('all');
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState('');
  const [confirm,  setConfirm]  = useState(null); // { id, mode, title }

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: PER_PAGE };
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const { data } = await api.get('/super/events', { params });
      setEvents(data.data || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { load(1); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const totalPages = Math.ceil(total / PER_PAGE);

  const publish = async (id) => {
    try {
      await api.post(`/super/events/${id}/publish`, {});
      showToast('Événement publié'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const archive = async (id) => {
    try {
      await api.post(`/super/events/${id}/archive`, {});
      showToast('Événement archivé'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const handleReject = async (reason) => {
    try {
      await api.post(`/super/events/${confirm.id}/reject`, { reason });
      showToast('Événement rejeté'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/super/events/${confirm.id}`);
      showToast('Événement supprimé'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Agenda</h1>
          <p className={styles.managerSub}>Validation et gestion de tous les événements ({total} total)</p>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
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

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1)}
          placeholder="Rechercher par titre ou catégorie…"
          className={styles.input}
          style={{ maxWidth: 320 }}
        />
        <button className={styles.btnSecondary} onClick={() => load(1)}>Rechercher</button>
        {search && <button className={styles.btnSecondary} onClick={() => setSearch('')}>✕</button>}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Titre</th><th>Date</th><th>Hôtel</th><th>Soumis par</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Chargement…</td></tr>
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
                            onClick={() => setConfirm({ id: ev.id, mode: 'reject', title: ev.title || ev.slug })}>
                            Rejeter
                          </button>
                        </>
                      )}
                      {ev.status === 'published' && (
                        <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => archive(ev.id)}>Archiver</button>
                      )}
                      <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => setConfirm({ id: ev.id, mode: 'delete', title: ev.title || ev.slug })}>
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={p => load(p)} />

      <ConfirmModal
        open={confirm?.mode === 'reject'}
        title="Rejeter cet événement"
        message={`Événement : ${confirm?.title}`}
        mode="reason"
        danger
        onConfirm={handleReject}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.mode === 'delete'}
        title="Supprimer cet événement ?"
        message={`Cette action est irréversible. Événement : "${confirm?.title}"`}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
