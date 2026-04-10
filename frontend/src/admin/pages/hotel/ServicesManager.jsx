import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperHotelId } from '../../components/SuperHotelSelector';
import styles from '../../Admin.module.css';

const EMPTY_SVC = {
  category_id: '', slug: '', duration_min: '', price_fcfa: 0,
  contact_phone: '', booking_info: '', available_hours: '', display_order: 0,
  name_fr: '', description_fr: '',
};

export default function ServicesManager() {
  const { user }   = useAuth();
  const hotelId  = useSuperHotelId(user);
  const params   = hotelId ? { hotel_id: hotelId } : {};
  const [services, setServices] = useState([]);
  const [cats,     setCats]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState(EMPTY_SVC);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');


  const load = useCallback(async () => {
    try {
      const [{ data: sv }, { data: ct }] = await Promise.all([
        api.get('/hotel/services', { params }),
        api.get('/hotel/services/categories', { params }),
      ]);
      setServices(sv);
      setCats(ct);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm({ ...EMPTY_SVC, category_id: cats[0]?.id || '' }); setModal('create'); };
  const openEdit   = sv => {
    setForm({ category_id: sv.category_id, slug: sv.slug,
      duration_min: sv.duration_min || '', price_fcfa: sv.price_fcfa || 0,
      contact_phone: sv.contact_phone || '', booking_info: sv.booking_info || '',
      available_hours: sv.available_hours || '', display_order: sv.display_order || 0,
      name_fr: sv.name || '', description_fr: sv.description || '' });
    setModal(sv);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        category_id:    form.category_id,
        slug:           form.slug,
        duration_min:   form.duration_min ? parseInt(form.duration_min) : null,
        price_fcfa:     parseInt(form.price_fcfa) || 0,
        contact_phone:  form.contact_phone || null,
        booking_info:   form.booking_info  || null,
        available_hours: form.available_hours || null,
        display_order:  parseInt(form.display_order) || 0,
        translations:   [{ locale: 'fr', name: form.name_fr, description: form.description_fr }],
      };
      if (modal === 'create') {
        await api.post('/hotel/services', body, { params });
        showToast('Service créé');
      } else {
        await api.put(`/hotel/services/${modal.id}`, body, { params });
        showToast('Service mis à jour');
      }
      setModal(null); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const del = async (id, name) => {
    if (!window.confirm(`Supprimer "${name}" ?`)) return;
    await api.delete(`/hotel/services/${id}`, { params });
    showToast('Service supprimé'); load();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Services & bien-être</h1>
          <p className={styles.managerSub}>{services.length} service{services.length !== 1 ? 's' : ''} enregistré{services.length !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate} disabled={cats.length === 0}>
          + Ajouter un service
        </button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {cats.length === 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, fontSize: '0.88rem', color: '#92400E' }}>
          Aucune catégorie disponible. Créez d'abord une catégorie dans les catégories globales (super-admin) ou ajoutez-en une propre à votre hôtel.
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom</th><th>Catégorie</th><th>Durée</th><th>Prix (FCFA)</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr><td colSpan={5}><div className={styles.empty}><div className={styles.emptyIcon}>💆</div><div className={styles.emptyText}>Aucun service</div></div></td></tr>
            ) : services.map(sv => (
              <tr key={sv.id}>
                <td style={{ fontWeight: 600 }}>{sv.name || sv.slug}</td>
                <td style={{ color: '#6B7280' }}>{sv.category_icon} {sv.category_fr}</td>
                <td style={{ color: '#6B7280' }}>{sv.duration_min ? `${sv.duration_min} min` : '—'}</td>
                <td style={{ color: '#6B7280' }}>{sv.price_fcfa ? sv.price_fcfa.toLocaleString() : 'Gratuit'}</td>
                <td>
                  <div className={styles.tdActions}>
                    <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(sv)}>Modifier</button>
                    <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => del(sv.id, sv.name || sv.slug)}>Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className={styles.modalBackdrop} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouveau service' : `Modifier — ${modal.name || modal.slug}`}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Nom (FR) *</label>
                <input className={styles.input} value={form.name_fr}
                  onChange={e => setForm(f => ({ ...f, name_fr: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea className={styles.textarea} value={form.description_fr}
                  onChange={e => setForm(f => ({ ...f, description_fr: e.target.value }))} />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Catégorie *</label>
                  <select className={styles.select} value={form.category_id}
                    onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label_fr}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Slug *</label>
                  <input className={styles.input} value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Durée (min)</label>
                  <input className={styles.input} type="number" value={form.duration_min}
                    onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Prix (FCFA)</label>
                  <input className={styles.input} type="number" value={form.price_fcfa}
                    onChange={e => setForm(f => ({ ...f, price_fcfa: e.target.value }))} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Téléphone contact</label>
                  <input className={styles.input} value={form.contact_phone}
                    onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Horaires disponibles</label>
                  <input className={styles.input} value={form.available_hours} placeholder="ex: 8h-20h"
                    onChange={e => setForm(f => ({ ...f, available_hours: e.target.value }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Info réservation</label>
                <textarea className={styles.textarea} value={form.booking_info}
                  onChange={e => setForm(f => ({ ...f, booking_info: e.target.value }))} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save}
                disabled={saving || !form.name_fr || !form.slug || !form.category_id}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
