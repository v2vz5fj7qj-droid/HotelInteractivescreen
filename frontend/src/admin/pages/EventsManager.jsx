import React, { useState, useEffect, useCallback } from 'react';
import api    from '../useAdminApi';
import styles from '../Admin.module.css';

const EMPTY = { slug:'', category:'', start_date:'', end_date:'', start_time:'', end_time:'', location:'', lat:'', lng:'', price_fcfa:0, image_url:'', is_featured:false, is_active:true, display_order:0, translations:{ fr:{title:'',description:'',tags:''}, en:{title:'',description:'',tags:''} } };

export default function EventsManager() {
  const [items,   setItems]   = useState([]);
  const [cats,    setCats]    = useState([]);
  const [modal,   setModal]   = useState(null);
  const [editing, setEditing] = useState(EMPTY);
  const [tab,     setTab]     = useState('fr');
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');

  const load = useCallback(() =>
    api.get('/events').then(r => setItems(r.data)).catch(() => {}), []);

  const loadCats = useCallback(() =>
    api.get('/categories/events').then(r => {
      setCats(r.data);
      if (r.data.length > 0) setEditing(e => ({ ...e, category: e.category || r.data[0].key_name }));
    }).catch(() => {}), []);

  useEffect(() => { load(); loadCats(); }, [load, loadCats]);

  const openCreate = () => { setEditing({ ...structuredClone(EMPTY), category: cats[0]?.key_name || '' }); setModal('create'); setTab('fr'); };
  const openEdit   = item => {
    setEditing({
      ...item,
      start_date: item.start_date?.slice(0,10) || '',
      end_date:   item.end_date?.slice(0,10)   || '',
      is_featured: !!item.is_featured,
      is_active:   !!item.is_active,
      translations: {
        fr: item.translations?.fr || { title:'', description:'', tags:'' },
        en: item.translations?.en || { title:'', description:'', tags:'' },
      },
    });
    setModal('edit');
    setTab('fr');
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') await api.post('/events', editing);
      else                    await api.put(`/events/${editing.id}`, editing);
      setMsg('✅ Enregistré'); load(); setModal(null);
    } catch { setMsg('❌ Erreur'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const del = async id => {
    if (!confirm('Supprimer cet événement ?')) return;
    await api.delete(`/events/${id}`).catch(() => {});
    load();
  };

  const set = (f, v) => setEditing(e => ({ ...e, [f]: v }));
  const setTr = (locale, f, v) => setEditing(e => ({
    ...e, translations: { ...e.translations, [locale]: { ...e.translations[locale], [f]: v } }
  }));

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Agenda des Événements</h2>
          <p className={styles.pageSubtitle}>{items.length} événement(s)</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Nouvel événement</button>
      </div>

      {msg && <p style={{ marginBottom:16, fontWeight:600 }}>{msg}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Titre (FR)</th><th>Catégorie</th><th>Date début</th><th>Prix</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#6B7280' }}>Aucun événement</td></tr>
            )}
            {items.map(it => (
              <tr key={it.id}>
                <td>
                  <strong>{it.translations?.fr?.title || it.slug}</strong>
                  {it.is_featured && <span className={`${styles.badge} ${styles.badgeFeatured}`} style={{ marginLeft:8 }}>★ À la une</span>}
                </td>
                <td>{cats.find(c => c.key_name === it.category)?.icon || ''} {cats.find(c => c.key_name === it.category)?.label_fr || it.category}</td>
                <td style={{ fontSize:'0.82rem' }}>{it.start_date?.slice(0,10)}</td>
                <td>{it.price_fcfa === 0 ? <span style={{ color:'#10B981', fontWeight:700 }}>Gratuit</span> : `${Number(it.price_fcfa).toLocaleString()} F`}</td>
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

      {modal && (
        <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal==='create' ? 'Nouvel événement' : 'Modifier l\'événement'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Slug</label>
                  <input className={styles.input} value={editing.slug} onChange={e => set('slug', e.target.value)} disabled={modal==='edit'} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Catégorie</label>
                  <select className={styles.select} value={editing.category} onChange={e => set('category', e.target.value)}>
                    {cats.map(c => <option key={c.key_name} value={c.key_name}>{c.icon} {c.label_fr}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Date début</label>
                  <input className={styles.input} type="date" value={editing.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Date fin (optionnel)</label>
                  <input className={styles.input} type="date" value={editing.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Heure début</label>
                  <input className={styles.input} type="time" value={editing.start_time} onChange={e => set('start_time', e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Heure fin</label>
                  <input className={styles.input} type="time" value={editing.end_time} onChange={e => set('end_time', e.target.value)} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Lieu</label>
                  <input className={styles.input} value={editing.location} onChange={e => set('location', e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Prix (FCFA — 0 = gratuit)</label>
                  <input className={styles.input} type="number" value={editing.price_fcfa} onChange={e => set('price_fcfa', +e.target.value)} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Latitude</label>
                  <input className={styles.input} type="number" step="0.0001" value={editing.lat} onChange={e => set('lat', e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Longitude</label>
                  <input className={styles.input} type="number" step="0.0001" value={editing.lng} onChange={e => set('lng', e.target.value)} />
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>URL Image</label>
                <input className={styles.input} value={editing.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." />
                {editing.image_url && (
                  <img src={editing.image_url} alt="Aperçu" onError={e => { e.target.style.display='none'; }}
                    style={{ marginTop: 8, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid #E5E7EB', width: '100%' }} />
                )}
              </div>
              <div style={{ display:'flex', gap:24 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.88rem', fontWeight:600, cursor:'pointer' }}>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={editing.is_featured} onChange={e => set('is_featured', e.target.checked)} />
                    <span className={styles.toggleSlider} />
                  </label>
                  À la une
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.88rem', fontWeight:600, cursor:'pointer' }}>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={editing.is_active} onChange={e => set('is_active', e.target.checked)} />
                    <span className={styles.toggleSlider} />
                  </label>
                  Actif
                </label>
              </div>

              <div>
                <div className={styles.tabs}>
                  {['fr','en'].map(l => (
                    <button key={l} className={`${styles.tab} ${tab===l?styles.tabActive:''}`} onClick={()=>setTab(l)}>
                      {l==='fr'?'🇫🇷 Français':'🇬🇧 English'}
                    </button>
                  ))}
                </div>
                <div className={styles.field}><label className={styles.label}>Titre</label>
                  <input className={styles.input} value={editing.translations[tab]?.title||''} onChange={e=>setTr(tab,'title',e.target.value)} /></div>
                <div className={styles.field} style={{marginTop:12}}><label className={styles.label}>Description</label>
                  <textarea className={styles.textarea} value={editing.translations[tab]?.description||''} onChange={e=>setTr(tab,'description',e.target.value)} /></div>
                <div className={styles.field} style={{marginTop:12}}><label className={styles.label}>Tags (séparés par des virgules)</label>
                  <input className={styles.input} value={editing.translations[tab]?.tags||''} onChange={e=>setTr(tab,'tags',e.target.value)} placeholder="ex: musique,concert,gratuit" /></div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save} disabled={saving}>{saving?'Enregistrement…':'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
