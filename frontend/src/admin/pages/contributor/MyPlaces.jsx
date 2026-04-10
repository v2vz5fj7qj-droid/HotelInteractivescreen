import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const STATUS_STYLE = {
  pending:   { bg: '#FEF3C7', color: '#92400E', label: 'En attente de validation' },
  published: { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
};

const EMPTY = { name: '', category: 'restaurant', lat: '', lng: '', address: '', phone: '', website: '' };
const CATEGORIES = ['restaurant', 'bar', 'musée', 'plage', 'parc', 'shopping', 'santé', 'transport', 'loisirs', 'autre'];

export default function MyPlaces() {
  const { user }  = useAuth();
  const [places,  setPlaces]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/contributor/places', { headers });
      setPlaces(data);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit   = p => {
    setForm({ name: p.name || '', category: p.category || 'restaurant',
      lat: p.lat || '', lng: p.lng || '', address: p.address || '',
      phone: p.phone || '', website: p.website || '' });
    setModal(p);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name, category: form.category,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        address: form.address || null, phone: form.phone || null, website: form.website || null,
        translations: [{ locale: 'fr', name: form.name }],
      };
      if (modal === 'create') {
        await axios.post('/api/admin/contributor/places', body, { headers });
        showToast('Lieu soumis — en attente de validation');
      } else {
        await axios.put(`/api/admin/contributor/places/${modal.id}`, body, { headers });
        showToast('Lieu resoumis');
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
          <h1 className={styles.managerTitle}>Mes lieux</h1>
          <p className={styles.managerSub}>Soumissions de points d'intérêt</p>
        </div>
        {user?.can_submit_places && (
          <button className={styles.btnPrimary} onClick={openCreate}>+ Soumettre un lieu</button>
        )}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {!user?.can_submit_places && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, fontSize: '0.88rem', color: '#991B1B' }}>
          Vous n'avez pas la permission de soumettre des lieux. Contactez votre administrateur.
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Nom</th><th>Catégorie</th><th>Statut</th><th>Soumis le</th><th>Actions</th></tr></thead>
          <tbody>
            {places.length === 0 ? (
              <tr><td colSpan={5}><div className={styles.empty}><div className={styles.emptyIcon}>🗺️</div><div className={styles.emptyText}>Aucune soumission</div></div></td></tr>
            ) : places.map(p => {
              const st = STATUS_STYLE[p.status] || STATUS_STYLE.pending;
              const canEdit = p.status === 'pending' || p.status === 'rejected';
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name || '—'}</td>
                  <td style={{ color: '#6B7280' }}>{p.category}</td>
                  <td>
                    <div>
                      <span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      {p.rejection_reason && (
                        <div style={{ fontSize: '0.75rem', color: '#991B1B', marginTop: 4 }}>
                          Motif : {p.rejection_reason}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td>
                    {canEdit && (
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => openEdit(p)}>
                        {p.status === 'rejected' ? 'Corriger & Resoumettre' : 'Modifier'}
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
              <span className={styles.modalTitle}>{modal === 'create' ? 'Soumettre un lieu' : 'Corriger la soumission'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Nom du lieu *</label>
                <input className={styles.input} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Catégorie</label>
                <select className={styles.select} value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Latitude</label>
                  <input className={styles.input} type="number" step="0.000001" value={form.lat}
                    onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Longitude</label>
                  <input className={styles.input} type="number" step="0.000001" value={form.lng}
                    onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Adresse</label>
                <input className={styles.input} value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Téléphone</label>
                  <input className={styles.input} value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Site web</label>
                  <input className={styles.input} value={form.website}
                    onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save} disabled={saving || !form.name}>
                {saving ? 'Soumission…' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
