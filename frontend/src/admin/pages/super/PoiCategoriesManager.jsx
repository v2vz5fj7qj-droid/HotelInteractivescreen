import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import ConfirmModal from '../../components/ConfirmModal';
import styles from '../../Admin.module.css';

const EMPTY = { key_name: '', label_fr: '', label_en: '', icon: '📍', color: '#C2782A', display_order: 0, hotel_id: '' };

export default function PoiCategoriesManager() {
  const [cats,    setCats]    = useState([]);
  const [hotels,  setHotels]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);   // null | 'create' | category-object
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try {
      const [{ data: catData }, { data: hotelData }] = await Promise.all([
        api.get('/super/poi-categories'),
        api.get('/super/hotels'),
      ]);
      setCats(catData);
      setHotels(hotelData);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate   = () => { setForm(EMPTY); setModal('create'); };
  const openRegister = key => { setForm({ ...EMPTY, key_name: key }); setModal('create'); };
  const openEdit     = c => {
    setForm({
      key_name:      c.key_name,
      label_fr:      c.label_fr,
      label_en:      c.label_en || '',
      icon:          c.icon || '📍',
      color:         c.color || '#C2782A',
      display_order: c.display_order || 0,
      hotel_id:      c.hotel_id || '',
    });
    setModal(c);
  };

  const save = async () => {
    if (!form.key_name.trim() || !form.label_fr.trim()) return;
    setSaving(true);
    try {
      const payload = { ...form, hotel_id: form.hotel_id || null };
      if (modal === 'create') {
        await api.post('/super/poi-categories', payload);
        showToast('Catégorie créée');
      } else {
        await api.put(`/super/poi-categories/${modal.id}`, payload);
        showToast('Catégorie mise à jour');
      }
      setModal(null); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/super/poi-categories/${confirm.id}`);
      showToast('Catégorie supprimée'); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  const hotelName = id => hotels.find(h => h.id === id)?.name || '—';

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Catégories — Carte &amp; Lieux</h1>
          <p className={styles.managerSub}>Catégories globales ou propres à un hôtel pour les points d'intérêt</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Ajouter</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Icône</th>
              <th>Clé</th>
              <th>Label FR</th>
              <th>Label EN</th>
              <th>Couleur</th>
              <th>Ordre</th>
              <th>Hôtel</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cats.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>📍</div>
                    <div className={styles.emptyText}>Aucune catégorie</div>
                  </div>
                </td>
              </tr>
            ) : cats.map(c => (
              <tr key={c.id ?? `orphan-${c.key_name}`} style={c.is_orphan ? { opacity: 0.8 } : undefined}>
                <td style={{ fontSize: '1.4rem' }}>{c.icon}</td>
                <td><code style={{ fontSize: '0.78rem', background: '#1F2937', padding: '2px 6px', borderRadius: 4 }}>{c.key_name}</code></td>
                <td style={{ fontWeight: 600 }}>{c.is_orphan ? <em style={{ color: '#9CA3AF' }}>{c.label_fr}</em> : c.label_fr}</td>
                <td style={{ color: '#6B7280' }}>{c.label_en || '—'}</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 16, height: 16, borderRadius: 4, background: c.color, border: '1px solid #374151', display: 'inline-block' }} />
                    <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{c.color}</span>
                  </span>
                </td>
                <td>{c.is_orphan ? '—' : c.display_order}</td>
                <td>
                  {c.is_orphan
                    ? <span className={styles.badge} style={{ background: '#78350F22', color: '#D97706' }}>Utilisée dans les données</span>
                    : c.hotel_id
                      ? <span className={styles.badge} style={{ background: '#C2782A22', color: '#C2782A' }}>{c.hotel_name || hotelName(c.hotel_id)}</span>
                      : <span className={styles.badge} style={{ background: '#8B5CF622', color: '#8B5CF6' }}>Global</span>}
                </td>
                <td>
                  {c.is_orphan
                    ? <span className={styles.badge} style={{ background: '#EF444422', color: '#EF4444' }}>⚠ Non enregistrée</span>
                    : <span className={`${styles.badge} ${c.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>}
                </td>
                <td>
                  <div className={styles.tdActions}>
                    {c.is_orphan ? (
                      <button className={styles.btnPrimary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                        onClick={() => openRegister(c.key_name)}>Enregistrer</button>
                    ) : (
                      <>
                        <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                          onClick={() => openEdit(c)}>Modifier</button>
                        <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => setConfirm(c)}>Supprimer</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                {modal === 'create' ? 'Nouvelle catégorie — Carte & Lieux' : `Modifier — ${modal.label_fr}`}
              </span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Clé technique (key_name) *</label>
                <input
                  className={styles.input}
                  value={form.key_name}
                  placeholder="ex: restaurant"
                  disabled={modal !== 'create'}
                  onChange={e => setForm(f => ({ ...f, key_name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                />
                <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 2 }}>
                  Identifiant unique, non modifiable après création
                </span>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Icône (emoji)</label>
                  <input className={styles.input} value={form.icon}
                    onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Couleur</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={form.color}
                      onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      style={{ width: 40, height: 36, padding: 2, border: '1px solid #374151', borderRadius: 6, background: 'transparent', cursor: 'pointer' }} />
                    <input className={styles.input} value={form.color}
                      onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                      style={{ flex: 1 }} />
                  </div>
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
              <div className={styles.field}>
                <label className={styles.label}>Affecter à un hôtel</label>
                <select className={styles.input} value={form.hotel_id}
                  onChange={e => setForm(f => ({ ...f, hotel_id: e.target.value }))}>
                  <option value="">— Global (tous les hôtels) —</option>
                  {hotels.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 2 }}>
                  Laisser vide pour une catégorie visible par tous les hôtels
                </span>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save}
                disabled={saving || !form.key_name.trim() || !form.label_fr.trim()}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirm}
        title={`Supprimer "${confirm?.label_fr}" ?`}
        message="Cette catégorie sera définitivement supprimée. Les lieux utilisant cette catégorie devront être réassignés."
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
