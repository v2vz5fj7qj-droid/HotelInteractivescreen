import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const EMPTY = { email: '', password: '', role: 'hotel_admin', hotel_id: '',
  can_submit_places: false, can_submit_events: false, can_submit_info: false };

const ROLE_LABELS = {
  super_admin: 'Super Admin', hotel_admin: 'Admin Hôtel',
  hotel_staff: 'Staff Hôtel', contributor: 'Contributeur',
};

export default function UsersManager() {
  const { user } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [hotels,  setHotels]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    try {
      const [u, h] = await Promise.all([
        axios.get('/api/admin/super/users',  { headers }),
        axios.get('/api/admin/super/hotels', { headers }),
      ]);
      setUsers(u.data);
      setHotels(h.data.filter(h => h.is_active));
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit   = u => {
    setForm({ email: u.email, password: '', role: u.role, hotel_id: u.hotel_id || '',
      can_submit_places: !!u.can_submit_places, can_submit_events: !!u.can_submit_events,
      can_submit_info: !!u.can_submit_info });
    setModal(u);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...form, hotel_id: form.hotel_id || null };
      if (modal === 'create') {
        await axios.post('/api/admin/super/users', body, { headers });
        showToast('Utilisateur créé');
      } else {
        if (!body.password) delete body.password;
        await axios.put(`/api/admin/super/users/${modal.id}`, body, { headers });
        showToast('Utilisateur mis à jour');
      }
      setModal(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    } finally { setSaving(false); }
  };

  const toggle = async (u) => {
    await axios.put(`/api/admin/super/users/${u.id}`, { is_active: u.is_active ? 0 : 1 }, { headers });
    showToast(u.is_active ? 'Utilisateur désactivé' : 'Utilisateur activé');
    load();
  };

  const needsHotel = ['hotel_admin', 'hotel_staff'].includes(form.role);
  const isContrib  = form.role === 'contributor';

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Utilisateurs</h1>
          <p className={styles.managerSub}>{users.length} compte{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Ajouter un utilisateur</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Email</th><th>Rôle</th><th>Hôtel</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5}><div className={styles.empty}><div className={styles.emptyIcon}>👤</div><div className={styles.emptyText}>Aucun utilisateur</div></div></td></tr>
            ) : users.map(u => {
              const hotel = hotels.find(h => h.id === u.hotel_id);
              return (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.email}</td>
                  <td><span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4B5563' }}>{ROLE_LABELS[u.role] || u.role}</span></td>
                  <td style={{ color: '#6B7280' }}>{hotel?.name || '—'}</td>
                  <td><span className={`${styles.badge} ${u.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                    {u.is_active ? 'Actif' : 'Inactif'}
                  </span></td>
                  <td>
                    <div className={styles.tdActions}>
                      <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                        onClick={() => openEdit(u)}>Modifier</button>
                      <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                        onClick={() => toggle(u)}>{u.is_active ? 'Désactiver' : 'Activer'}</button>
                    </div>
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
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouvel utilisateur' : `Modifier — ${modal.email}`}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Email *</label>
                <input className={styles.input} type="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{modal === 'create' ? 'Mot de passe *' : 'Nouveau mot de passe (laisser vide pour ne pas changer)'}</label>
                <input className={styles.input} type="password" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Rôle *</label>
                  <select className={styles.select} value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {needsHotel && (
                  <div className={styles.field}>
                    <label className={styles.label}>Hôtel *</label>
                    <select className={styles.select} value={form.hotel_id}
                      onChange={e => setForm(f => ({ ...f, hotel_id: e.target.value }))}>
                      <option value="">— Sélectionner —</option>
                      {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {isContrib && (
                <div className={styles.field}>
                  <label className={styles.label}>Permissions de soumission</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    {[['can_submit_places', 'Lieux'], ['can_submit_events', 'Événements'], ['can_submit_info', 'Infos utiles']].map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={form[key]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save}
                disabled={saving || !form.email || (modal === 'create' && !form.password)}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
