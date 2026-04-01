import React, { useState, useEffect, useCallback } from 'react';
import api    from '../useAdminApi';
import styles from '../Admin.module.css';

const SECTION_POI    = 'poi';
const SECTION_INFO   = 'info';
const SECTION_EVENTS = 'events';

const EMPTY_CAT = {
  key_name: '', label_fr: '', label_en: '',
  icon: '📍', color: '#C2782A', display_order: 0, is_active: true,
};

function CategoryModal({ cat, onClose, onSaved, type }) {
  const [form,   setForm]   = useState({ ...EMPTY_CAT, ...cat });
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const isNew = !cat?.id;

  const set = (f, v) => setForm(e => ({ ...e, [f]: v }));

  const save = async () => {
    if (!form.label_fr || !form.label_en) {
      setMsg('❌ Les libellés FR et EN sont requis'); return;
    }
    if (isNew && !form.key_name) {
      setMsg('❌ La clé est requise'); return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await api.post(`/categories/${type}`, form);
      } else {
        await api.put(`/categories/${type}/${cat.id}`, form);
      }
      onSaved();
      onClose();
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Erreur'}`);
    } finally { setSaving(false); }
  };

  return (
    <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 480 }}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {isNew ? 'Nouvelle catégorie' : 'Modifier la catégorie'}
          </span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>

          {msg && <p style={{ marginBottom: 12, fontWeight: 600 }}>{msg}</p>}

          {isNew && (
            <div className={styles.field}>
              <label className={styles.label}>
                Clé unique <small style={{ color: '#9CA3AF' }}>(lettres minuscules, chiffres, _ — non modifiable après création)</small>
              </label>
              <input className={styles.input} value={form.key_name}
                onChange={e => set('key_name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="ex: nightclub" />
            </div>
          )}

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Libellé FR</label>
              <input className={styles.input} value={form.label_fr}
                onChange={e => set('label_fr', e.target.value)} placeholder="ex: Boîtes de nuit" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Libellé EN</label>
              <input className={styles.input} value={form.label_en}
                onChange={e => set('label_en', e.target.value)} placeholder="ex: Nightclubs" />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Icône (emoji)</label>
              <input className={styles.input} value={form.icon}
                onChange={e => set('icon', e.target.value)} placeholder="🏠"
                style={{ fontSize: '1.4rem', textAlign: 'center' }} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Couleur</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.color}
                  onChange={e => set('color', e.target.value)}
                  style={{ width: 44, height: 38, padding: 2, border: '1px solid #E5E7EB', borderRadius: 8, cursor: 'pointer' }} />
                <input className={styles.input} value={form.color}
                  onChange={e => set('color', e.target.value)} placeholder="#C2782A"
                  style={{ flex: 1, fontFamily: 'monospace' }} />
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ordre</label>
              <input className={styles.input} type="number" value={form.display_order}
                onChange={e => set('display_order', parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <label className={styles.toggle}>
              <input type="checkbox" checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)} />
              <span className={styles.toggleSlider} />
            </label>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Catégorie active</span>
          </div>

          <div style={{ marginTop: 16, padding: '10px 14px', background: '#F9FAFB', borderRadius: 10,
            border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: form.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
              {form.icon}
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>
                {form.label_fr || 'Libellé FR'} / {form.label_en || 'Label EN'}
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'monospace' }}>
                key: {form.key_name || '…'}
              </p>
            </div>
          </div>

        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ cat, allCats, onClose, onDeleted, type }) {
  const [reassignTo, setReassignTo] = useState('');
  const [count,      setCount]      = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [msg,        setMsg]        = useState('');

  useEffect(() => {
    api.get(`/categories/${type}/${cat.id}/count`)
      .then(r => setCount(r.data.count))
      .catch(() => setCount(0));
  }, [cat.id, type]);

  const confirm = async () => {
    if (count > 0 && !reassignTo) {
      setMsg('❌ Choisissez une catégorie de réaffectation'); return;
    }
    setDeleting(true);
    try {
      await api.delete(`/categories/${type}/${cat.id}`, { data: { reassign_to: reassignTo || undefined } });
      onDeleted();
      onClose();
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Erreur'}`);
    } finally { setDeleting(false); }
  };

  const others = allCats.filter(c => c.id !== cat.id);

  return (
    <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 420 }}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Supprimer la catégorie</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>

          {msg && <p style={{ fontWeight: 600 }}>{msg}</p>}

          <p style={{ marginBottom: 12 }}>
            Supprimer <strong>{cat.icon} {cat.label_fr}</strong> ?
          </p>

          {count === null && (
            <p style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Vérification en cours…</p>
          )}

          {count !== null && count > 0 && (
            <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '12px 14px', marginBottom: 14,
              border: '1px solid #FCD34D' }}>
              <p style={{ margin: '0 0 10px', fontWeight: 600, color: '#92400E', fontSize: '0.88rem' }}>
                ⚠️ {count} élément(s) utilisent cette catégorie. Choisissez où les réaffecter :
              </p>
              <select className={styles.select} value={reassignTo}
                onChange={e => setReassignTo(e.target.value)}>
                <option value="">— Sélectionner une catégorie —</option>
                {others.map(c => (
                  <option key={c.id} value={c.key_name}>{c.icon} {c.label_fr}</option>
                ))}
              </select>
            </div>
          )}

          {count !== null && count === 0 && (
            <p style={{ color: '#6B7280', fontSize: '0.85rem' }}>
              Aucun élément attaché — la suppression est immédiate.
            </p>
          )}

        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Annuler</button>
          <button
            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 18px', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}
            onClick={confirm}
            disabled={deleting || count === null || (count > 0 && !reassignTo)}
          >
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriesManager() {
  const [section,     setSection]     = useState(SECTION_POI);
  const [cats,        setCats]        = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [editModal,   setEditModal]   = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [msg,         setMsg]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/categories/${section}`);
      setCats(r.data);
    } catch { setCats([]); }
    finally { setLoading(false); }
  }, [section]);

  useEffect(() => { load(); }, [load]);

  const flash = m => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Gestion des catégories</h2>
          <p className={styles.pageSubtitle}>
            {cats.length} catégorie(s) — {section === SECTION_POI ? 'Carte & POI' : section === SECTION_INFO ? 'Infos utiles' : 'Agenda'}
          </p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setEditModal({})}>
          + Nouvelle catégorie
        </button>
      </div>

      <div className={styles.tabs} style={{ marginBottom: 20 }}>
        <button
          className={`${styles.tab} ${section === SECTION_POI ? styles.tabActive : ''}`}
          onClick={() => setSection(SECTION_POI)}
        >
          🗺️ Carte & POI
        </button>
        <button
          className={`${styles.tab} ${section === SECTION_INFO ? styles.tabActive : ''}`}
          onClick={() => setSection(SECTION_INFO)}
        >
          📞 Infos utiles
        </button>
        <button
          className={`${styles.tab} ${section === SECTION_EVENTS ? styles.tabActive : ''}`}
          onClick={() => setSection(SECTION_EVENTS)}
        >
          🗓️ Agenda
        </button>
      </div>

      {msg && <p style={{ marginBottom: 16, fontWeight: 600 }}>{msg}</p>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>Chargement…</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Clé</th>
                <th>Libellé FR / EN</th>
                <th>Couleur</th>
                <th>Ordre</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cats.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#6B7280' }}>
                    Aucune catégorie
                  </td>
                </tr>
              )}
              {cats.map(cat => (
                <tr key={cat.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: cat.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem', flexShrink: 0 }}>
                        {cat.icon}
                      </div>
                      <strong>{cat.label_fr}</strong>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#6B7280' }}>
                    {cat.key_name}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {cat.label_fr}<br />
                    <span style={{ color: '#9CA3AF' }}>{cat.label_en}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, background: cat.color,
                        border: '1px solid #E5E7EB' }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#6B7280' }}>
                        {cat.color}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', color: '#6B7280' }}>{cat.display_order}</td>
                  <td>
                    <span className={`${styles.badge} ${cat.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                      {cat.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.tdActions}>
                      <button className={styles.btnSecondary} onClick={() => setEditModal(cat)}>✏️</button>
                      <button className={styles.btnDanger} onClick={() => setDeleteModal(cat)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editModal !== null && (
        <CategoryModal
          cat={editModal}
          type={section}
          onClose={() => setEditModal(null)}
          onSaved={() => { load(); flash('✅ Catégorie enregistrée'); }}
        />
      )}

      {deleteModal !== null && (
        <DeleteModal
          cat={deleteModal}
          allCats={cats}
          type={section}
          onClose={() => setDeleteModal(null)}
          onDeleted={() => { load(); flash('✅ Catégorie supprimée'); }}
        />
      )}
    </div>
  );
}
