import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const STATUS_STYLE = {
  pending:   { bg: '#FEF3C7', color: '#92400E', label: 'En attente de validation' },
  published: { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
};

const EMPTY = { category: 'urgence', phone: '', whatsapp: '', website: '', name_fr: '', description_fr: '' };
const CATEGORIES = ['urgence', 'santé', 'transport', 'tourisme', 'administration', 'commerce', 'autre'];

export default function MyInfo() {
  const { user }  = useAuth();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/admin/contributor/info', { headers });
      setItems(data);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit   = it => {
    setForm({ category: it.category || 'urgence', phone: it.phone || '',
      whatsapp: it.whatsapp || '', website: it.website || '',
      name_fr: it.name || '', description_fr: it.description || '' });
    setModal(it);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        category: form.category,
        phone:    form.phone    || null,
        whatsapp: form.whatsapp || null,
        website:  form.website  || null,
        translations: [{ locale: 'fr', name: form.name_fr, description: form.description_fr }],
      };
      if (modal === 'create') {
        await axios.post('/api/admin/contributor/info', body, { headers });
        showToast('Info soumise — en attente de validation');
      } else {
        await axios.put(`/api/admin/contributor/info/${modal.id}`, body, { headers });
        showToast('Info resoumise');
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
          <h1 className={styles.managerTitle}>Mes infos utiles</h1>
          <p className={styles.managerSub}>Soumissions de contacts et informations utiles</p>
        </div>
        {user?.can_submit_info && (
          <button className={styles.btnPrimary} onClick={openCreate}>+ Soumettre une info</button>
        )}
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {!user?.can_submit_info && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, fontSize: '0.88rem', color: '#991B1B' }}>
          Vous n'avez pas la permission de soumettre des infos utiles. Contactez votre administrateur.
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Nom</th><th>Catégorie</th><th>Téléphone</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={5}><div className={styles.empty}><div className={styles.emptyIcon}>📞</div><div className={styles.emptyText}>Aucune soumission</div></div></td></tr>
            ) : items.map(it => {
              const st = STATUS_STYLE[it.status] || STATUS_STYLE.pending;
              const canEdit = it.status === 'pending' || it.status === 'rejected';
              return (
                <tr key={it.id}>
                  <td style={{ fontWeight: 600 }}>{it.name || '—'}</td>
                  <td style={{ color: '#6B7280' }}>{it.category}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{it.phone || it.whatsapp || '—'}</td>
                  <td>
                    <div>
                      <span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      {it.rejection_reason && (
                        <div style={{ fontSize: '0.75rem', color: '#991B1B', marginTop: 4 }}>
                          Motif : {it.rejection_reason}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {canEdit && (
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => openEdit(it)}>
                        {it.status === 'rejected' ? 'Corriger & Resoumettre' : 'Modifier'}
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
              <span className={styles.modalTitle}>{modal === 'create' ? 'Soumettre une info utile' : 'Corriger la soumission'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Nom / Raison sociale *</label>
                <input className={styles.input} value={form.name_fr}
                  onChange={e => setForm(f => ({ ...f, name_fr: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Description</label>
                <textarea className={styles.textarea} value={form.description_fr}
                  onChange={e => setForm(f => ({ ...f, description_fr: e.target.value }))} />
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
                  <label className={styles.label}>Téléphone</label>
                  <input className={styles.input} value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>WhatsApp</label>
                  <input className={styles.input} value={form.whatsapp}
                    onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} />
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
              <button className={styles.btnPrimary} onClick={save} disabled={saving || !form.name_fr}>
                {saving ? 'Soumission…' : 'Soumettre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
