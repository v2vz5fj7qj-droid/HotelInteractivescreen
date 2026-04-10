import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const EMPTY = { label_fr: '', label_en: '', icon: '✨', display_order: 0 };

export default function ServiceCategoriesManager() {
  const { user }  = useAuth();
  const [cats,    setCats]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/super/service-categories', { headers });
      setCats(data);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit   = c => { setForm({ label_fr: c.label_fr, label_en: c.label_en || '', icon: c.icon || '✨', display_order: c.display_order || 0 }); setModal(c); };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') {
        await axios.post('/api/admin/super/service-categories', form, { headers });
        showToast('Catégorie créée');
      } else {
        await axios.put(`/api/admin/super/service-categories/${modal.id}`, form, { headers });
        showToast('Catégorie mise à jour');
      }
      setModal(null); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const del = async (c) => {
    if (!window.confirm(`Supprimer "${c.label_fr}" ?`)) return;
    try {
      await axios.delete(`/api/admin/super/service-categories/${c.id}`, { headers });
      showToast('Catégorie supprimée'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Catégories de services</h1>
          <p className={styles.managerSub}>Catégories globales partagées par tous les hôtels</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Ajouter</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Icône</th><th>Label FR</th><th>Label EN</th><th>Ordre</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {cats.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>🏷️</div><div className={styles.emptyText}>Aucune catégorie</div></div></td></tr>
            ) : cats.map(c => (
              <tr key={c.id}>
                <td style={{ fontSize: '1.4rem' }}>{c.icon}</td>
                <td style={{ fontWeight: 600 }}>{c.label_fr}</td>
                <td style={{ color: '#6B7280' }}>{c.label_en || '—'}</td>
                <td>{c.display_order}</td>
                <td><span className={`${styles.badge} ${c.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                  {c.is_active ? 'Active' : 'Inactive'}
                </span></td>
                <td><div className={styles.tdActions}>
                  <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                    onClick={() => openEdit(c)}>Modifier</button>
                  <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                    onClick={() => del(c)}>Supprimer</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className={styles.modalBackdrop} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouvelle catégorie' : `Modifier — ${modal.label_fr}`}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Icône (emoji)</label>
                  <input className={styles.input} value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Ordre d'affichage</label>
                  <input className={styles.input} type="number" value={form.display_order}
                    onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Label FR *</label>
                <input className={styles.input} value={form.label_fr}
                  onChange={e => setForm(f => ({ ...f, label_fr: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Label EN</label>
                <input className={styles.input} value={form.label_en}
                  onChange={e => setForm(f => ({ ...f, label_en: e.target.value }))} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save} disabled={saving || !form.label_fr}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
