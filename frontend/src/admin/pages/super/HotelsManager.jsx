import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const EMPTY = { name: '', city: '', country: '', address: '', phone: '', email: '', website: '' };

export default function HotelsManager() {
  const { user } = useAuth();
  const [hotels,  setHotels]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | 'create' | hotel object
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/super/hotels', { headers });
      setHotels(data);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit   = h => { setForm({ name: h.name, city: h.city || '', country: h.country || '',
    address: h.address || '', phone: h.phone || '', email: h.email || '', website: h.website || '' });
    setModal(h); };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') {
        await axios.post('/api/admin/super/hotels', form, { headers });
        showToast('Hôtel créé');
      } else {
        await axios.put(`/api/admin/super/hotels/${modal.id}`, form, { headers });
        showToast('Hôtel mis à jour');
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    } finally { setSaving(false); }
  };

  const toggle = async (h) => {
    await axios.put(`/api/admin/super/hotels/${h.id}`, { is_active: h.is_active ? 0 : 1 }, { headers });
    showToast(h.is_active ? 'Hôtel désactivé' : 'Hôtel activé');
    load();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Hôtels</h1>
          <p className={styles.managerSub}>{hotels.length} hôtel{hotels.length !== 1 ? 's' : ''} enregistré{hotels.length !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Ajouter un hôtel</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom</th><th>Ville</th><th>Pays</th><th>Email</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {hotels.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>🏨</div><div className={styles.emptyText}>Aucun hôtel</div></div></td></tr>
            ) : hotels.map(h => (
              <tr key={h.id}>
                <td style={{ fontWeight: 700 }}>{h.name}</td>
                <td>{h.city || '—'}</td>
                <td>{h.country || '—'}</td>
                <td style={{ color: '#6B7280' }}>{h.email || '—'}</td>
                <td><span className={`${styles.badge} ${h.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                  {h.is_active ? 'Actif' : 'Inactif'}
                </span></td>
                <td>
                  <div className={styles.tdActions}>
                    <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(h)}>Modifier</button>
                    <button className={`${styles.btnSecondary}`} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                      onClick={() => toggle(h)}>{h.is_active ? 'Désactiver' : 'Activer'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal !== null && (
        <div className={styles.modalBackdrop} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouvel hôtel' : `Modifier — ${modal.name}`}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Nom *</label>
                <input className={styles.input} value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Ville</label>
                  <input className={styles.input} value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Pays</label>
                  <input className={styles.input} value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
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
                  <label className={styles.label}>Email</label>
                  <input className={styles.input} type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Site web</label>
                <input className={styles.input} value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save} disabled={saving || !form.name}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
