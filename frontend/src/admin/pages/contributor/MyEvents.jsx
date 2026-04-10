import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const STATUS_STYLE = {
  pending:   { bg: '#FEF3C7', color: '#92400E', label: 'En attente de validation' },
  published: { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
  archived:  { bg: '#F3F4F6', color: '#6B7280', label: 'Archivé' },
};

const EMPTY = {
  slug: '', category: 'culture', start_date: '', end_date: '', start_time: '',
  location: '', price_fcfa: 0, title_fr: '', description_fr: '',
};

const CATEGORIES = ['culture', 'sport', 'gastronomie', 'musique', 'art', 'business', 'tourisme', 'autre'];

export default function MyEvents() {
  const { user }  = useAuth();
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');


  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/contributor/events');
      setEvents(data);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit   = ev => {
    setForm({ slug: ev.slug, category: ev.category || 'culture',
      start_date: ev.start_date?.split('T')[0] || '', end_date: ev.end_date?.split('T')[0] || '',
      start_time: ev.start_time || '', location: ev.location || '',
      price_fcfa: ev.price_fcfa || 0, title_fr: ev.title || '', description_fr: '' });
    setModal(ev);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        slug: form.slug, category: form.category, start_date: form.start_date,
        end_date: form.end_date || null, start_time: form.start_time || null,
        location: form.location || null, price_fcfa: parseInt(form.price_fcfa) || 0,
        translations: [{ locale: 'fr', title: form.title_fr, description: form.description_fr }],
      };
      if (modal === 'create') {
        await api.post('/contributor/events', body);
        showToast('Événement soumis — en attente de validation');
      } else {
        await api.put(`/contributor/events/${modal.id}`, body);
        showToast('Événement resoumis');
      }
      setModal(null); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Mes événements</h1>
          <p className={styles.managerSub}>Soumissions d'événements</p>
        </div>
        {user?.can_submit_events && (
          <button className={styles.btnPrimary} onClick={openCreate}>+ Soumettre un événement</button>
        )}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {!user?.can_submit_events && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, fontSize: '0.88rem', color: '#991B1B' }}>
          Vous n'avez pas la permission de soumettre des événements. Contactez votre administrateur.
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Titre</th><th>Date</th><th>Catégorie</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={5}><div className={styles.empty}><div className={styles.emptyIcon}>🗓️</div><div className={styles.emptyText}>Aucune soumission</div></div></td></tr>
            ) : events.map(ev => {
              const st = STATUS_STYLE[ev.status] || STATUS_STYLE.pending;
              const canEdit = ev.status === 'pending' || ev.status === 'rejected';
              return (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 600 }}>{ev.title || ev.slug}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>
                    {ev.start_date ? new Date(ev.start_date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ color: '#6B7280' }}>{ev.category}</td>
                  <td>
                    <div>
                      <span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      {ev.rejection_reason && (
                        <div style={{ fontSize: '0.75rem', color: '#991B1B', marginTop: 4 }}>
                          Motif : {ev.rejection_reason}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {canEdit && (
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => openEdit(ev)}>
                        {ev.status === 'rejected' ? 'Corriger & Resoumettre' : 'Modifier'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className={styles.modalBackdrop} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Soumettre un événement' : 'Corriger la soumission'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Titre *</label>
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
                  <label className={styles.label}>Slug * (identifiant unique)</label>
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
                  <label className={styles.label}>Date de début *</label>
                  <input className={styles.input} type="date" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Date de fin</label>
                  <input className={styles.input} type="date" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Heure</label>
                  <input className={styles.input} type="time" value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Prix (FCFA)</label>
                  <input className={styles.input} type="number" value={form.price_fcfa}
                    onChange={e => setForm(f => ({ ...f, price_fcfa: e.target.value }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Lieu</label>
                <input className={styles.input} value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save}
                disabled={saving || !form.title_fr || !form.slug || !form.start_date}>
                {saving ? 'Soumission…' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
