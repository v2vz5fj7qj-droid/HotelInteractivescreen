import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperHotelId } from '../../components/SuperHotelSelector';
import styles from '../../Admin.module.css';

const EMPTY = { titre_fr: '', titre_en: '', contenu_fr: '', contenu_en: '', categorie: '', display_order: 0 };

export default function TipsManager() {
  const { user }  = useAuth();
  const hotelId = useSuperHotelId(user);
  const params  = hotelId ? { hotel_id: hotelId } : {};
  const [tips,    setTips]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [tab,     setTab]     = useState('fr');
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');


  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/hotel/tips', { params });
      setTips(data);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY); setTab('fr'); setModal('create'); };
  const openEdit   = t => {
    setForm({ titre_fr: t.titre_fr || '', titre_en: t.titre_en || '',
      contenu_fr: t.contenu_fr || '', contenu_en: t.contenu_en || '',
      categorie: t.categorie || '', display_order: t.display_order || 0 });
    setTab('fr'); setModal(t);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/hotel/tips', form, { params });
        showToast('Conseil créé');
      } else {
        await api.put(`/hotel/tips/${modal.id}`, form, { params });
        showToast('Conseil mis à jour');
      }
      setModal(null); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (t) => {
    await api.put(`/hotel/tips/${t.id}`, { is_active: t.is_active ? 0 : 1 }, { params });
    showToast(t.is_active ? 'Conseil désactivé' : 'Conseil activé'); load();
  };

  const del = async (id, titre) => {
    if (!window.confirm(`Supprimer "${titre}" ?`)) return;
    await api.delete(`/hotel/tips/${id}`, { params });
    showToast('Conseil supprimé'); load();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Bon à savoir</h1>
          <p className={styles.managerSub}>Conseils et informations utiles pour les clients</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Ajouter</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Titre (FR)</th><th>Catégorie</th><th>Ordre</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {tips.length === 0 ? (
              <tr><td colSpan={5}><div className={styles.empty}><div className={styles.emptyIcon}>💡</div><div className={styles.emptyText}>Aucun conseil</div></div></td></tr>
            ) : tips.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.titre_fr}</td>
                <td style={{ color: '#6B7280' }}>{t.categorie || '—'}</td>
                <td>{t.display_order}</td>
                <td><span className={`${styles.badge} ${t.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                  {t.is_active ? 'Actif' : 'Inactif'}
                </span></td>
                <td>
                  <div className={styles.tdActions}>
                    <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(t)}>Modifier</button>
                    <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => toggleActive(t)}>{t.is_active ? 'Désactiver' : 'Activer'}</button>
                    <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => del(t.id, t.titre_fr)}>Supprimer</button>
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
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouveau conseil' : `Modifier — ${modal.titre_fr}`}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.tabs}>
                {[['fr', 'Français'], ['en', 'Anglais']].map(([code, label]) => (
                  <button key={code} className={`${styles.tab} ${tab === code ? styles.tabActive : ''}`}
                    onClick={() => setTab(code)}>{label}</button>
                ))}
              </div>
              {tab === 'fr' && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Titre FR *</label>
                    <input className={styles.input} value={form.titre_fr}
                      onChange={e => setForm(f => ({ ...f, titre_fr: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Contenu FR *</label>
                    <textarea className={styles.textarea} value={form.contenu_fr}
                      onChange={e => setForm(f => ({ ...f, contenu_fr: e.target.value }))} />
                  </div>
                </>
              )}
              {tab === 'en' && (
                <>
                  <div className={styles.field}>
                    <label className={styles.label}>Titre EN</label>
                    <input className={styles.input} value={form.titre_en}
                      onChange={e => setForm(f => ({ ...f, titre_en: e.target.value }))} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Contenu EN</label>
                    <textarea className={styles.textarea} value={form.contenu_en}
                      onChange={e => setForm(f => ({ ...f, contenu_en: e.target.value }))} />
                  </div>
                </>
              )}
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Catégorie</label>
                  <input className={styles.input} value={form.categorie} placeholder="ex: Sécurité, Santé…"
                    onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Ordre d'affichage</label>
                  <input className={styles.input} type="number" value={form.display_order}
                    onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save}
                disabled={saving || !form.titre_fr || !form.contenu_fr}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
