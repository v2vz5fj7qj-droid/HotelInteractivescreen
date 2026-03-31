import React, { useState, useEffect, useCallback, useRef } from 'react';
import api    from '../useAdminApi';
import styles from '../Admin.module.css';

const CATS  = ['restaurant','museum','pharmacy','taxi','hospital','attraction','market'];
const EMPTY = {
  category: 'restaurant', lat: '', lng: '', phone: '', website: '', is_active: true,
  translations: {
    fr: { name: '', address: '', description: '' },
    en: { name: '', address: '', description: '' },
  },
};

export default function POIManager() {
  const [items,   setItems]   = useState([]);
  const [modal,   setModal]   = useState(null);   // 'create' | 'edit'
  const [editing, setEditing] = useState(EMPTY);
  const [tab,     setTab]     = useState('fr');
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [filter,  setFilter]  = useState('all');
  const [imgUploading, setImgUploading] = useState(false);
  const fileInputRef = useRef(null);

  const load = useCallback(() =>
    api.get('/poi').then(r => setItems(r.data)).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(structuredClone(EMPTY)); setModal('create'); setTab('fr'); };
  const openEdit   = item => {
    setEditing({
      ...item,
      is_active: !!item.is_active,
      images: item.images || [],
      translations: {
        fr: { name: '', address: '', description: '', ...item.translations?.fr },
        en: { name: '', address: '', description: '', ...item.translations?.en },
      },
    });
    setModal('edit'); setTab('fr');
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') {
        const r = await api.post('/poi', editing);
        setMsg('✅ Créé — ouvrez l\'édition pour ajouter des images.');
        load();
        setModal(null);
        // Auto-ouvre le mode édition pour permettre d'ajouter des images
        const { data: fresh } = await api.get('/poi');
        const created = fresh.find(p => p.id === r.data.id);
        if (created) { setTimeout(() => openEdit(created), 300); }
      } else {
        await api.put(`/poi/${editing.id}`, editing);
        setMsg('✅ Enregistré');
        // Rafraîchit juste les images de ce POI dans l'état local
        load();
      }
    } catch { setMsg('❌ Erreur'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 4000); }
  };

  const del = async id => {
    if (!confirm('Supprimer ce point d\'intérêt ?')) return;
    await api.delete(`/poi/${id}`).catch(() => {});
    load();
  };

  // ── Gestion images ──────────────────────────────────────
  const uploadImage = async (file) => {
    if (!file || !editing.id) return;
    if ((editing.images || []).length >= 3) {
      setMsg('❌ Maximum 3 images atteint'); setTimeout(() => setMsg(''), 3000); return;
    }
    setImgUploading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const r = await api.post(`/poi/${editing.id}/images`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditing(e => ({ ...e, images: [...(e.images || []), { id: r.data.id, url: r.data.url }] }));
      setMsg('✅ Image ajoutée');
    } catch (err) {
      setMsg(`❌ ${err.response?.data?.error || 'Erreur upload'}`);
    } finally {
      setImgUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setMsg(''), 3000);
      load();
    }
  };

  const deleteImage = async (imgId) => {
    if (!confirm('Supprimer cette image ?')) return;
    try {
      await api.delete(`/poi/images/${imgId}`);
      setEditing(e => ({ ...e, images: (e.images || []).filter(i => i.id !== imgId) }));
      setMsg('✅ Image supprimée');
      load();
    } catch { setMsg('❌ Erreur suppression'); }
    finally { setTimeout(() => setMsg(''), 3000); }
  };

  // ── Helpers état ───────────────────────────────────────
  const set   = (f, v) => setEditing(e => ({ ...e, [f]: v }));
  const setTr = (locale, f, v) => setEditing(e => ({
    ...e, translations: { ...e.translations, [locale]: { ...e.translations[locale], [f]: v } }
  }));

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Carte & Points d'intérêt</h2>
          <p className={styles.pageSubtitle}>{items.length} point(s) sur la carte</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Nouveau POI</button>
      </div>

      {msg && <p style={{ marginBottom: 16, fontWeight: 600 }}>{msg}</p>}

      {/* Filtres par catégorie */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {['all', ...CATS].map(c => (
          <button key={c} onClick={() => setFilter(c)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid #E5E7EB', cursor: 'pointer',
              background: filter === c ? '#C2782A' : '#fff',
              color: filter === c ? '#fff' : '#374151',
              fontSize: '0.82rem', fontWeight: 600, fontFamily: 'Poppins,sans-serif',
            }}
          >
            {c === 'all' ? 'Tous' : c}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom (FR)</th><th>Catégorie</th><th>Coordonnées</th><th>Images</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#6B7280' }}>Aucun point d'intérêt</td></tr>
            )}
            {filtered.map(it => (
              <tr key={it.id}>
                <td>
                  <strong>{it.translations?.fr?.name || '—'}</strong>
                  <br /><small style={{ color: '#9CA3AF' }}>{it.translations?.fr?.address || ''}</small>
                  {it.translations?.fr?.description && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#6B7280', maxWidth: 260,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {it.translations.fr.description}
                    </p>
                  )}
                </td>
                <td style={{ textTransform: 'capitalize' }}>{it.category}</td>
                <td style={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'monospace' }}>{it.lat}, {it.lng}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(it.images || []).map(img => (
                      <img key={img.id} src={img.url} alt=""
                        style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, border: '1px solid #E5E7EB' }} />
                    ))}
                    {(it.images || []).length === 0 && <span style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>—</span>}
                  </div>
                </td>
                <td><span className={`${styles.badge} ${it.is_active ? styles.badgeActive : styles.badgeInactive}`}>{it.is_active ? 'Actif' : 'Inactif'}</span></td>
                <td><div className={styles.tdActions}>
                  <button className={styles.btnSecondary} onClick={() => openEdit(it)}>✏️</button>
                  <button className={styles.btnDanger}    onClick={() => del(it.id)}>🗑</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 600 }}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouveau POI' : 'Modifier le POI'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>

              {/* Catégorie */}
              <div className={styles.field}>
                <label className={styles.label}>Catégorie</label>
                <select className={styles.select} value={editing.category} onChange={e => set('category', e.target.value)}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Coordonnées */}
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Latitude</label>
                  <input className={styles.input} type="number" step="0.0001" value={editing.lat}
                    onChange={e => set('lat', e.target.value)} placeholder="12.3641" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Longitude</label>
                  <input className={styles.input} type="number" step="0.0001" value={editing.lng}
                    onChange={e => set('lng', e.target.value)} placeholder="-1.5332" />
                </div>
              </div>

              {/* Contact */}
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Téléphone</label>
                  <input className={styles.input} value={editing.phone || ''}
                    onChange={e => set('phone', e.target.value)} placeholder="+226 25 00 00 00" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Site web</label>
                  <input className={styles.input} value={editing.website || ''}
                    onChange={e => set('website', e.target.value)} placeholder="https://..." />
                </div>
              </div>

              {/* Toggle actif */}
              <div className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={editing.is_active} onChange={e => set('is_active', e.target.checked)} />
                  <span className={styles.toggleSlider} />
                </label>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Point actif (visible sur la carte)</span>
              </div>

              {/* Traductions */}
              <div>
                <div className={styles.tabs}>
                  {['fr', 'en'].map(l => (
                    <button key={l} className={`${styles.tab} ${tab === l ? styles.tabActive : ''}`} onClick={() => setTab(l)}>
                      {l === 'fr' ? '🇫🇷 Français' : '🇬🇧 English'}
                    </button>
                  ))}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Nom du lieu</label>
                  <input className={styles.input} value={editing.translations[tab]?.name || ''}
                    onChange={e => setTr(tab, 'name', e.target.value)} />
                </div>
                <div className={styles.field} style={{ marginTop: 12 }}>
                  <label className={styles.label}>Adresse</label>
                  <input className={styles.input} value={editing.translations[tab]?.address || ''}
                    onChange={e => setTr(tab, 'address', e.target.value)} />
                </div>
                <div className={styles.field} style={{ marginTop: 12 }}>
                  <label className={styles.label}>Description</label>
                  <textarea
                    className={styles.input}
                    rows={3}
                    style={{ resize: 'vertical', minHeight: 72 }}
                    value={editing.translations[tab]?.description || ''}
                    onChange={e => setTr(tab, 'description', e.target.value)}
                    placeholder={tab === 'fr' ? 'Description du lieu…' : 'Place description…'}
                  />
                </div>
              </div>

              {/* ── Section images (mode édition uniquement) ── */}
              {modal === 'edit' && (
                <div style={{ marginTop: 20, borderTop: '1px solid #E5E7EB', paddingTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <strong style={{ fontSize: '0.88rem' }}>
                      Photos ({(editing.images || []).length}/3)
                    </strong>
                    {(editing.images || []).length < 3 && (
                      <>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: 'none' }}
                          onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])}
                        />
                        <button
                          className={styles.btnSecondary}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={imgUploading}
                          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                        >
                          {imgUploading ? 'Upload…' : '+ Ajouter une photo'}
                        </button>
                      </>
                    )}
                  </div>

                  {(editing.images || []).length === 0 && (
                    <p style={{ color: '#9CA3AF', fontSize: '0.82rem', textAlign: 'center', padding: '12px 0' }}>
                      Aucune photo — ajoutez jusqu'à 3 images (JPG, PNG, WebP · 3 Mo max)
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {(editing.images || []).map(img => (
                      <div key={img.id} style={{ position: 'relative' }}>
                        <img
                          src={img.url}
                          alt=""
                          style={{ width: 100, height: 75, objectFit: 'cover', borderRadius: 10,
                            border: '2px solid #E5E7EB' }}
                        />
                        <button
                          onClick={() => deleteImage(img.id)}
                          style={{
                            position: 'absolute', top: -6, right: -6,
                            width: 22, height: 22, borderRadius: '50%',
                            background: '#ef4444', border: 'none', color: '#fff',
                            fontSize: '0.7rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          aria-label="Supprimer l'image"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {modal === 'create' && (
                <p style={{ marginTop: 16, fontSize: '0.78rem', color: '#6B7280', fontStyle: 'italic' }}>
                  💡 Les photos pourront être ajoutées après la création du lieu.
                </p>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
