import React, { useState, useEffect, useCallback, useRef } from 'react';
import api              from '../useAdminApi';
import styles           from '../Admin.module.css';
import TranslationPanel from '../components/TranslationPanel';
import { useTranslate } from '../hooks/useTranslate';
import localesMeta      from '../../i18n/locales.json';

const ALL_LOCALES = Object.keys(localesMeta);
const emptyTr = () =>
  Object.fromEntries(ALL_LOCALES.map(l => [l, { name: '', description: '' }]));

const EMPTY = { slug:'', duration_min:60, price_fcfa:0, available_hours:'', available_days:'', image_url:'', video_url:'', is_active:true, translations: emptyTr() };

export default function WellnessManager() {
  const [items,        setItems]        = useState([]);
  const [modal,        setModal]        = useState(null);
  const [editing,      setEditing]      = useState(EMPTY);
  const [tab,          setTab]          = useState('fr');
  const [sourceLang,   setSourceLang]   = useState('fr');
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState('');
  const [uploading,    setUploading]    = useState(false);
  const imgInputRef = useRef(null);

  const { translateFields, translating } = useTranslate();

  const load = useCallback(() =>
    api.get('/wellness').then(r => setItems(r.data)).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(structuredClone(EMPTY)); setModal('create'); setTab('fr'); setSourceLang('fr'); };
  const openEdit   = item => {
    const allTr = Object.fromEntries(
      ALL_LOCALES.map(l => [l, { name: '', description: '', ...item.translations?.[l] }])
    );
    setEditing({ ...item, is_active: !!item.is_active, translations: allTr });
    setModal('edit'); setTab('fr'); setSourceLang('fr');
  };

  const handleTranslateAll = async () => {
    const result = await translateFields(
      ['name', 'description'],
      sourceLang,
      editing.translations[sourceLang],
      ALL_LOCALES,
    );
    setEditing(e => {
      const updated = { ...e.translations };
      for (const [locale, values] of Object.entries(result)) {
        updated[locale] = { ...updated[locale], ...values };
      }
      return { ...e, translations: updated };
    });
    setMsg('✅ Traduction automatique appliquée — vérifiez les onglets.');
    setTimeout(() => setMsg(''), 5000);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') await api.post('/wellness', editing);
      else                    await api.put(`/wellness/${editing.id}`, editing);
      setMsg('✅ Enregistré'); load(); setModal(null);
    } catch { setMsg('❌ Erreur lors de l\'enregistrement'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const del = async id => {
    if (!confirm('Supprimer ce service ?')) return;
    await api.delete(`/wellness/${id}`).catch(() => {});
    load();
  };

  const uploadImage = async (file) => {
    if (!editing.id) return; // ne peut uploader qu'en mode édition (après création)
    const fd = new FormData();
    fd.append('image', file);
    setUploading(true);
    try {
      const r = await api.post(`/wellness/${editing.id}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      set('image_url', r.data.url);
      setMsg('✅ Image uploadée');
    } catch { setMsg('❌ Erreur upload image'); }
    finally { setUploading(false); setTimeout(() => setMsg(''), 3000); }
  };

  const set = (field, val) => setEditing(e => ({ ...e, [field]: val }));
  const setTr = (locale, field, val) => setEditing(e => ({
    ...e, translations: { ...e.translations, [locale]: { ...e.translations[locale], [field]: val } }
  }));

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Services Bien-être</h2>
          <p className={styles.pageSubtitle}>{items.length} service(s) configuré(s)</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Nouveau service</button>
      </div>

      {msg && <p style={{ marginBottom: 16, fontWeight: 600 }}>{msg}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nom (FR)</th><th>Durée</th><th>Prix (FCFA)</th>
              <th>Horaires</th><th>Statut</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#6B7280' }}>Aucun service — cliquez sur "+ Nouveau service"</td></tr>
            )}
            {items.map(it => (
              <tr key={it.id}>
                <td><strong>{it.translations?.fr?.name || it.slug}</strong></td>
                <td>{it.duration_min} min</td>
                <td>{Number(it.price_fcfa).toLocaleString('fr-BF')} F CFA</td>
                <td style={{ fontSize:'0.82rem', color:'#6B7280' }}>{it.available_hours || '—'}</td>
                <td><span className={`${styles.badge} ${it.is_active ? styles.badgeActive : styles.badgeInactive}`}>{it.is_active ? 'Actif' : 'Inactif'}</span></td>
                <td><div className={styles.tdActions}>
                  <button className={styles.btnSecondary} onClick={() => openEdit(it)}>✏️ Modifier</button>
                  <button className={styles.btnDanger}    onClick={() => del(it.id)}>🗑 Supprimer</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouveau service' : 'Modifier le service'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Slug (identifiant unique)</label>
                  <input className={styles.input} value={editing.slug} onChange={e => set('slug', e.target.value)} placeholder="ex: swedish-massage" disabled={modal==='edit'} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Durée (minutes)</label>
                  <input className={styles.input} type="number" value={editing.duration_min} onChange={e => set('duration_min', +e.target.value)} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Prix (F CFA)</label>
                  <input className={styles.input} type="number" value={editing.price_fcfa} onChange={e => set('price_fcfa', +e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Horaires disponibles</label>
                  <input className={styles.input} value={editing.available_hours} onChange={e => set('available_hours', e.target.value)} placeholder="ex: 09:00-19:00" />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Jours disponibles</label>
                  <input className={styles.input} value={editing.available_days} onChange={e => set('available_days', e.target.value)} placeholder="ex: Lun-Sam" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Image</label>
                  {editing.image_url && (
                    <img
                      src={editing.image_url}
                      alt="Aperçu"
                      onError={e => { e.target.style.display='none'; }}
                      style={{ display:'block', marginBottom:8, height:80, borderRadius:8, objectFit:'cover', border:'1px solid #E5E7EB' }}
                    />
                  )}
                  <input className={styles.input} value={editing.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://... ou uploader ci-dessous" />
                  {modal === 'edit' && (
                    <>
                      <input
                        ref={imgInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display:'none' }}
                        onChange={e => { if (e.target.files[0]) uploadImage(e.target.files[0]); }}
                      />
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ marginTop:6 }}
                        disabled={uploading}
                        onClick={() => imgInputRef.current?.click()}
                      >
                        {uploading ? 'Upload en cours…' : '📁 Uploader une image'}
                      </button>
                    </>
                  )}
                  {modal === 'create' && (
                    <p style={{ fontSize:'0.78rem', color:'#6B7280', marginTop:4 }}>
                      L'upload de fichier sera disponible après la création du service.
                    </p>
                  )}
                </div>
              </div>
              <div className={styles.field} style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={editing.is_active} onChange={e => set('is_active', e.target.checked)} />
                  <span className={styles.toggleSlider} />
                </label>
                <span style={{ fontSize:'0.88rem', fontWeight:600 }}>Service actif (visible sur la borne)</span>
              </div>

              {/* ── Traductions ── */}
              <TranslationPanel
                sourceLang={sourceLang}
                onSourceChange={setSourceLang}
                allLocales={ALL_LOCALES}
                onTranslateAll={handleTranslateAll}
                translating={translating}
              />

              <div>
                <div className={styles.tabs} style={{ flexWrap: 'wrap' }}>
                  {ALL_LOCALES.map(l => (
                    <button key={l} className={`${styles.tab} ${tab === l ? styles.tabActive : ''}`}
                      onClick={() => setTab(l)} style={{ position: 'relative' }}
                    >
                      {localesMeta[l]?.flag} {l}
                      {l === sourceLang && (
                        <span style={{
                          position: 'absolute', top: -4, right: -4,
                          width: 8, height: 8, borderRadius: '50%',
                          background: '#C2782A', border: '1px solid #fff',
                        }} />
                      )}
                    </button>
                  ))}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Nom du service</label>
                  <input className={styles.input} value={editing.translations[tab]?.name || ''} onChange={e => setTr(tab, 'name', e.target.value)} />
                </div>
                <div className={styles.field} style={{ marginTop: 12 }}>
                  <label className={styles.label}>Description</label>
                  <textarea className={styles.textarea} value={editing.translations[tab]?.description || ''} onChange={e => setTr(tab, 'description', e.target.value)} />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
