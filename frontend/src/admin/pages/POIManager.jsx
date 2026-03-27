import React, { useState, useEffect, useCallback } from 'react';
import api    from '../useAdminApi';
import styles from '../Admin.module.css';

const CATS = ['restaurant','museum','pharmacy','taxi','hospital','attraction','market'];
const EMPTY = { category:'restaurant', lat:'', lng:'', phone:'', website:'', is_active:true, translations:{ fr:{name:'',address:''}, en:{name:'',address:''} } };

export default function POIManager() {
  const [items,   setItems]   = useState([]);
  const [modal,   setModal]   = useState(null);
  const [editing, setEditing] = useState(EMPTY);
  const [tab,     setTab]     = useState('fr');
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [filter,  setFilter]  = useState('all');

  const load = useCallback(() =>
    api.get('/poi').then(r => setItems(r.data)).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(structuredClone(EMPTY)); setModal('create'); setTab('fr'); };
  const openEdit   = item => {
    setEditing({
      ...item,
      is_active: !!item.is_active,
      translations: {
        fr: item.translations?.fr || { name:'', address:'' },
        en: item.translations?.en || { name:'', address:'' },
      },
    });
    setModal('edit'); setTab('fr');
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') await api.post('/poi', editing);
      else                    await api.put(`/poi/${editing.id}`, editing);
      setMsg('✅ Enregistré'); load(); setModal(null);
    } catch { setMsg('❌ Erreur'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const del = async id => {
    if (!confirm('Supprimer ce point d\'intérêt ?')) return;
    await api.delete(`/poi/${id}`).catch(() => {});
    load();
  };

  const set = (f, v) => setEditing(e => ({ ...e, [f]: v }));
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

      {msg && <p style={{ marginBottom:16, fontWeight:600 }}>{msg}</p>}

      {/* Filtres par catégorie */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
        {['all', ...CATS].map(c => (
          <button key={c} onClick={() => setFilter(c)}
            style={{
              padding:'6px 14px', borderRadius:20, border:'1px solid #E5E7EB', cursor:'pointer',
              background: filter===c ? '#C2782A' : '#fff',
              color: filter===c ? '#fff' : '#374151',
              fontSize:'0.82rem', fontWeight:600, fontFamily:'Poppins,sans-serif',
            }}
          >
            {c === 'all' ? 'Tous' : c}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom (FR)</th><th>Catégorie</th><th>Coordonnées</th><th>Téléphone</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#6B7280' }}>Aucun point d'intérêt</td></tr>
            )}
            {filtered.map(it => (
              <tr key={it.id}>
                <td><strong>{it.translations?.fr?.name || '—'}</strong><br/><small style={{color:'#9CA3AF'}}>{it.translations?.fr?.address || ''}</small></td>
                <td style={{ textTransform:'capitalize' }}>{it.category}</td>
                <td style={{ fontSize:'0.78rem', color:'#6B7280', fontFamily:'monospace' }}>{it.lat}, {it.lng}</td>
                <td style={{ fontSize:'0.85rem' }}>{it.phone || '—'}</td>
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
              <span className={styles.modalTitle}>{modal==='create' ? 'Nouveau POI' : 'Modifier le POI'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Catégorie</label>
                <select className={styles.select} value={editing.category} onChange={e => set('category', e.target.value)}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}><label className={styles.label}>Latitude</label>
                  <input className={styles.input} type="number" step="0.0001" value={editing.lat} onChange={e => set('lat', e.target.value)} placeholder="12.3641" /></div>
                <div className={styles.field}><label className={styles.label}>Longitude</label>
                  <input className={styles.input} type="number" step="0.0001" value={editing.lng} onChange={e => set('lng', e.target.value)} placeholder="-1.5332" /></div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}><label className={styles.label}>Téléphone</label>
                  <input className={styles.input} value={editing.phone} onChange={e => set('phone', e.target.value)} placeholder="+226 25 00 00 00" /></div>
                <div className={styles.field}><label className={styles.label}>Site web</label>
                  <input className={styles.input} value={editing.website} onChange={e => set('website', e.target.value)} placeholder="https://..." /></div>
              </div>
              <div className={styles.field} style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={editing.is_active} onChange={e => set('is_active', e.target.checked)} />
                  <span className={styles.toggleSlider} />
                </label>
                <span style={{ fontSize:'0.88rem', fontWeight:600 }}>Point actif (visible sur la carte)</span>
              </div>
              <div>
                <div className={styles.tabs}>
                  {['fr','en'].map(l => (
                    <button key={l} className={`${styles.tab} ${tab===l?styles.tabActive:''}`} onClick={()=>setTab(l)}>
                      {l==='fr'?'🇫🇷 Français':'🇬🇧 English'}
                    </button>
                  ))}
                </div>
                <div className={styles.field}><label className={styles.label}>Nom du lieu</label>
                  <input className={styles.input} value={editing.translations[tab]?.name||''} onChange={e=>setTr(tab,'name',e.target.value)} /></div>
                <div className={styles.field} style={{marginTop:12}}><label className={styles.label}>Adresse</label>
                  <input className={styles.input} value={editing.translations[tab]?.address||''} onChange={e=>setTr(tab,'address',e.target.value)} /></div>
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
