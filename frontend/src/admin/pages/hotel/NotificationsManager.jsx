import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperHotelId } from '../../components/SuperHotelSelector';
import styles from '../../Admin.module.css';

const EMPTY = {
  message_fr: '', message_en: '', message_de: '', message_es: '',
  message_pt: '', message_ar: '', message_zh: '', message_ja: '', message_ru: '',
  display_order: 0,
};

const LANGS = [
  ['fr', 'Français'], ['en', 'Anglais'], ['de', 'Allemand'],
  ['es', 'Espagnol'], ['pt', 'Portugais'], ['ar', 'Arabe'],
  ['zh', 'Chinois'], ['ja', 'Japonais'], ['ru', 'Russe'],
];

export default function NotificationsManager() {
  const { user }  = useAuth();
  const hotelId = useSuperHotelId(user);
  const params  = hotelId ? { hotel_id: hotelId } : {};
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [tab,     setTab]     = useState('fr');
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');


  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/hotel/notifications', { params });
      setNotifs(data);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY); setTab('fr'); setModal('create'); };
  const openEdit   = n => {
    setForm({ message_fr: n.message_fr || '', message_en: n.message_en || '',
      message_de: n.message_de || '', message_es: n.message_es || '',
      message_pt: n.message_pt || '', message_ar: n.message_ar || '',
      message_zh: n.message_zh || '', message_ja: n.message_ja || '',
      message_ru: n.message_ru || '', display_order: n.display_order || 0 });
    setTab('fr'); setModal(n);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/hotel/notifications', form, { params });
        showToast('Notification créée');
      } else {
        await api.put(`/hotel/notifications/${modal.id}`, form, { params });
        showToast('Notification mise à jour');
      }
      setModal(null); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (n) => {
    await api.put(`/hotel/notifications/${n.id}`, { is_active: n.is_active ? 0 : 1 }, { params });
    showToast(n.is_active ? 'Notification désactivée' : 'Notification activée');
    load();
  };

  const del = async (id) => {
    if (!window.confirm('Supprimer cette notification ?')) return;
    await api.delete(`/hotel/notifications/${id}`, { params });
    showToast('Notification supprimée'); load();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Notifications borne</h1>
          <p className={styles.managerSub}>Messages rotatifs affichés sur la borne kiosque</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Ajouter</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Message (FR)</th><th>Ordre</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {notifs.length === 0 ? (
              <tr><td colSpan={4}><div className={styles.empty}><div className={styles.emptyIcon}>🔔</div><div className={styles.emptyText}>Aucune notification</div></div></td></tr>
            ) : notifs.map(n => (
              <tr key={n.id}>
                <td style={{ fontWeight: 500, maxWidth: 400 }}>{n.message_fr}</td>
                <td>{n.display_order}</td>
                <td><span className={`${styles.badge} ${n.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                  {n.is_active ? 'Active' : 'Inactive'}
                </span></td>
                <td>
                  <div className={styles.tdActions}>
                    <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(n)}>Modifier</button>
                    <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => toggleActive(n)}>{n.is_active ? 'Désactiver' : 'Activer'}</button>
                    <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => del(n.id)}>Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className={styles.modalBackdrop} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouvelle notification' : 'Modifier la notification'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.tabs}>
                {LANGS.map(([code, label]) => (
                  <button key={code} className={`${styles.tab} ${tab === code ? styles.tabActive : ''}`}
                    onClick={() => setTab(code)}>{label}</button>
                ))}
              </div>
              {LANGS.map(([code]) => (
                <div key={code} style={{ display: tab === code ? 'block' : 'none' }}>
                  <div className={styles.field}>
                    <label className={styles.label}>Message {code === 'fr' ? '*' : '(optionnel)'}</label>
                    <textarea className={styles.textarea} value={form[`message_${code}`] || ''}
                      onChange={e => setForm(f => ({ ...f, [`message_${code}`]: e.target.value }))} />
                  </div>
                </div>
              ))}
              <div className={styles.field}>
                <label className={styles.label}>Ordre d'affichage</label>
                <input className={styles.input} type="number" value={form.display_order}
                  onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save} disabled={saving || !form.message_fr}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
