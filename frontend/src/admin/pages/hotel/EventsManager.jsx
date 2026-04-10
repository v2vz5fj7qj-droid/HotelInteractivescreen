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

const EMPTY_EV = {
  slug: '', category: 'culture', start_date: '', end_date: '', start_time: '', end_time: '',
  location: '', price_fcfa: 0, is_featured: false, title_fr: '', description_fr: '',
};

const CATEGORIES = ['culture', 'sport', 'gastronomie', 'musique', 'art', 'business', 'tourisme', 'autre'];

export default function HotelEventsManager() {
  const { user }   = useAuth();
  const [events,   setEvents]   = useState([]);
  const [pending,  setPending]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState('events'); // 'events' | 'pending'
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState(EMPTY_EV);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: ev }, { data: pd }] = await Promise.all([
        axios.get('/api/admin/hotel/events',         { headers }),
        axios.get('/api/admin/hotel/events/pending', { headers }),
      ]);
      setEvents(ev);
      setPending(pd);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY_EV); setModal('create'); };
  const openEdit   = ev => {
    setForm({ slug: ev.slug, category: ev.category, start_date: ev.start_date?.split('T')[0] || '',
      end_date: ev.end_date?.split('T')[0] || '', start_time: ev.start_time || '', end_time: ev.end_time || '',
      location: ev.location || '', price_fcfa: ev.price_fcfa || 0, is_featured: !!ev.is_featured,
      title_fr: ev.title || '', description_fr: ev.description || '' });
    setModal(ev);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        slug: form.slug, category: form.category, start_date: form.start_date,
        end_date: form.end_date || null, start_time: form.start_time || null,
        end_time: form.end_time || null, location: form.location || null,
        price_fcfa: form.price_fcfa || 0, is_featured: form.is_featured ? 1 : 0,
        translations: [{ locale: 'fr', title: form.title_fr, description: form.description_fr }],
      };
      if (modal === 'create') {
        await axios.post('/api/admin/hotel/events', body, { headers });
        showToast('Événement créé');
      } else {
        await axios.put(`/api/admin/hotel/events/${modal.id}`, body, { headers });
        showToast('Événement mis à jour');
      }
      setModal(null); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const preApprove = async (id) => {
    try {
      await axios.post(`/api/admin/hotel/events/${id}/pre-approve`, {}, { headers });
      showToast('Événement pré-approuvé'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const rejectEv = async (id) => {
    const reason = window.prompt('Motif du rejet :');
    if (reason == null) return;
    try {
      await axios.post(`/api/admin/hotel/events/${id}/reject`, { reason }, { headers });
      showToast('Événement rejeté'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const archive = async (id) => {
    try {
      await axios.post(`/api/admin/hotel/events/${id}/archive`, {}, { headers });
      showToast('Événement archivé'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const del = async (id, title) => {
    if (!window.confirm(`Supprimer "${title}" ?`)) return;
    await axios.delete(`/api/admin/hotel/events/${id}`, { headers });
    showToast('Événement supprimé'); load();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Agenda</h1>
          <p className={styles.managerSub}>Événements de l'hôtel</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Créer un événement</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #E5E7EB' }}>
        {[['events', `Événements (${events.length})`], ['pending', `En attente (${pending.length})`]].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding: '10px 20px', border: 'none', background: 'transparent',
              fontFamily: 'Poppins, sans-serif', fontSize: '0.88rem', fontWeight: 600,
              borderBottom: view === v ? '2px solid #C2782A' : '2px solid transparent',
              color: view === v ? '#C2782A' : '#6B7280', cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Événements hôtel */}
      {view === 'events' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Titre</th><th>Date</th><th>Catégorie</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={5}><div className={styles.empty}><div className={styles.emptyIcon}>🗓️</div><div className={styles.emptyText}>Aucun événement</div></div></td></tr>
              ) : events.map(ev => {
                const st = STATUS_STYLE[ev.status] || STATUS_STYLE.published;
                return (
                  <tr key={ev.id}>
                    <td style={{ fontWeight: 600 }}>{ev.title || ev.slug}</td>
                    <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>
                      {ev.start_date ? new Date(ev.start_date).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ color: '#6B7280' }}>{ev.category}</td>
                    <td><span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td>
                      <div className={styles.tdActions}>
                        <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => openEdit(ev)}>Modifier</button>
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
      )}

      {/* Soumissions en attente de pré-approbation */}
      {view === 'pending' && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Titre</th><th>Date</th><th>Soumis par</th><th>Actions</th></tr></thead>
            <tbody>
              {pending.length === 0 ? (
                <tr><td colSpan={4}><div className={styles.empty}><div className={styles.emptyIcon}>✅</div><div className={styles.emptyText}>Aucune soumission en attente</div></div></td></tr>
              ) : pending.map(ev => (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 600 }}>{ev.title || ev.slug}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>
                    {ev.start_date ? new Date(ev.start_date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{ev.created_by_email || '—'}</td>
                  <td>
                    <div className={styles.tdActions}>
                      <button className={styles.btnPrimary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => preApprove(ev.id)}>Pré-approuver</button>
                      <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => rejectEv(ev.id)}>Rejeter</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal création/édition */}
      {modal !== null && (
        <div className={styles.modalBackdrop} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouvel événement' : `Modifier — ${modal.title || modal.slug}`}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Titre FR *</label>
                <input className={styles.input} value={form.title_fr}
                  onChange={e => setForm(f => ({ ...f, title_fr: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea className={styles.textarea} value={form.description_fr}
                  onChange={e => setForm(f => ({ ...f, description_fr: e.target.value }))} />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Slug *</label>
                  <input className={styles.input} value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Catégorie</label>
                  <select className={styles.select} value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Date début *</label>
                  <input className={styles.input} type="date" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Date fin</label>
                  <input className={styles.input} type="date" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Heure début</label>
                  <input className={styles.input} type="time" value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Heure fin</label>
                  <input className={styles.input} type="time" value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Lieu</label>
                  <input className={styles.input} value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Prix (FCFA)</label>
                  <input className={styles.input} type="number" value={form.price_fcfa}
                    onChange={e => setForm(f => ({ ...f, price_fcfa: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.is_featured}
                  onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} />
                Événement à la une
              </label>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save}
                disabled={saving || !form.title_fr || !form.slug || !form.start_date}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
