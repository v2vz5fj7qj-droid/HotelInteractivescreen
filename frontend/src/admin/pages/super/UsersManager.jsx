import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import styles from '../../Admin.module.css';

const EMPTY = { email: '', password: '', role: 'hotel_admin', hotel_id: '',
  can_submit_places: false, can_submit_events: false, can_submit_info: false };

const ROLE_LABELS = {
  super_admin: 'Super Admin', hotel_admin: 'Admin Hôtel',
  hotel_staff: 'Staff Hôtel', contributor: 'Contributeur',
};

const PER_PAGE = 25;

export default function UsersManager() {
  const [users,   setUsers]   = useState([]);
  const [hotels,  setHotels]  = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');
  const [confirm, setConfirm] = useState(null);

  // Charger la liste des hôtels (sans pagination — pour le sélecteur)
  useEffect(() => {
    api.get('/super/hotels').then(({ data }) => setHotels(Array.isArray(data) ? data.filter(h => h.is_active) : []));
  }, []);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: PER_PAGE };
      if (search)     params.search = search;
      if (roleFilter) params.role   = roleFilter;
      const { data } = await api.get('/super/users', { params });
      setUsers(data.data || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => { load(1); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const totalPages = Math.ceil(total / PER_PAGE);

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
        await api.post('/super/users', body);
        showToast('Utilisateur créé');
      } else {
        if (!body.password) delete body.password;
        await api.put(`/super/users/${modal.id}`, body);
        showToast('Utilisateur mis à jour');
      }
      setModal(null);
      load(page);
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    } finally { setSaving(false); }
  };

  const handleToggle = async () => {
    const u = confirm.user;
    try {
      await api.put(`/super/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
      showToast(u.is_active ? 'Utilisateur désactivé' : 'Utilisateur activé');
      load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  const needsHotel = ['hotel_admin', 'hotel_staff'].includes(form.role);
  const isContrib  = form.role === 'contributor';

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Utilisateurs</h1>
          <p className={styles.managerSub}>{total} compte{total !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Ajouter un utilisateur</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1)}
          placeholder="Rechercher par email…"
          className={styles.input}
          style={{ maxWidth: 280 }}
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className={styles.select} style={{ maxWidth: 180 }}>
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className={styles.btnSecondary} onClick={() => load(1)}>Filtrer</button>
        {(search || roleFilter) && (
          <button className={styles.btnSecondary}
            onClick={() => { setSearch(''); setRoleFilter(''); }}>✕ Effacer</button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Email</th><th>Rôle</th><th>Hôtel</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Chargement…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5}><div className={styles.empty}><div className={styles.emptyIcon}>👤</div><div className={styles.emptyText}>Aucun utilisateur</div></div></td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.email}</td>
                <td><span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4B5563' }}>{ROLE_LABELS[u.role] || u.role}</span></td>
                <td style={{ color: '#6B7280' }}>{u.hotel_nom || '—'}</td>
                <td><span className={`${styles.badge} ${u.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                  {u.is_active ? 'Actif' : 'Inactif'}
                </span></td>
                <td>
                  <div className={styles.tdActions}>
                    <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(u)}>Modifier</button>
                    <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                      onClick={() => setConfirm({ user: u })}>{u.is_active ? 'Désactiver' : 'Activer'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={p => load(p)} />

      {/* Modal création/édition */}
      {modal !== null && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
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
                <label className={styles.label}>{modal === 'create' ? 'Mot de passe *' : 'Nouveau mot de passe (laisser vide pour conserver)'}</label>
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
                      {hotels.map(h => <option key={h.id} value={h.id}>{h.nom}</option>)}
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

      <ConfirmModal
        open={!!confirm}
        title={confirm?.user?.is_active ? 'Désactiver cet utilisateur ?' : 'Activer cet utilisateur ?'}
        message={`Compte : ${confirm?.user?.email}`}
        danger={confirm?.user?.is_active}
        onConfirm={handleToggle}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
