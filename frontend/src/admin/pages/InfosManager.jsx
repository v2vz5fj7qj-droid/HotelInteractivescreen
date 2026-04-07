import React, { useState, useEffect, useCallback } from 'react';
import api              from '../useAdminApi';
import styles           from '../Admin.module.css';
import TranslationPanel from '../components/TranslationPanel';
import { useTranslate } from '../hooks/useTranslate';
import localesMeta      from '../../i18n/locales.json';

const ALL_LOCALES = Object.keys(localesMeta);
const emptyTr = () =>
  Object.fromEntries(ALL_LOCALES.map(l => [l, { name: '', description: '', address: '' }]));

const EMPTY = {
  category: '',
  phone: '', whatsapp: '', website: '',
  available_24h: false, display_order: 0, is_active: true,
  translations: emptyTr(),
};

export default function InfosManager() {
  const [items,   setItems]   = useState([]);
  const [cats,    setCats]    = useState([]);
  const [modal,   setModal]   = useState(null);
  const [editing, setEditing] = useState(EMPTY);
  const [tab,        setTab]        = useState('fr');
  const [sourceLang, setSourceLang] = useState('fr');
  const [saving,     setSaving]     = useState(false);
  const [msg,     setMsg]     = useState('');
  const [filter,  setFilter]  = useState('all');

  const { translateFields, translating } = useTranslate();

  const loadCats = useCallback(() =>
    api.get('/categories/info').then(r => setCats(r.data)).catch(() => {}), []);

  const load = useCallback(() =>
    api.get('/info').then(r => setItems(r.data)).catch(() => {}), []);

  useEffect(() => { load(); loadCats(); }, [load, loadCats]);

  const openCreate = () => {
    setEditing({ ...structuredClone(EMPTY), category: cats[0]?.key_name || '' });
    setModal('create'); setTab('fr'); setSourceLang('fr');
  };
  const openEdit = item => {
    const allTr = Object.fromEntries(
      ALL_LOCALES.map(l => [l, { name: '', description: '', address: '', ...item.translations?.[l] }])
    );
    setEditing({ ...item, is_active: !!item.is_active, available_24h: !!item.available_24h, translations: allTr });
    setModal('edit'); setTab('fr'); setSourceLang('fr');
  };

  const handleTranslateAll = async () => {
    const result = await translateFields(
      ['name', 'description', 'address'],
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
      if (modal === 'create') await api.post('/info', editing);
      else                    await api.put(`/info/${editing.id}`, editing);
      setMsg('✅ Enregistré'); load(); setModal(null);
    } catch { setMsg('❌ Erreur lors de la sauvegarde'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const del = async id => {
    if (!confirm('Supprimer ce contact ?')) return;
    await api.delete(`/info/${id}`).catch(() => {});
    load();
  };

  const set   = (f, v) => setEditing(e => ({ ...e, [f]: v }));
  const setTr = (locale, f, v) => setEditing(e => ({
    ...e, translations: { ...e.translations, [locale]: { ...e.translations[locale], [f]: v } }
  }));

  const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);
  const catLabel = key => { const c = cats.find(x => x.key_name === key); return c ? `${c.icon} ${c.label_fr}` : key; };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Infos utiles & Contacts</h2>
          <p className={styles.pageSubtitle}>{items.length} contact(s) enregistré(s)</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Nouveau contact</button>
      </div>

      {msg && <p style={{ marginBottom: 16, fontWeight: 600 }}>{msg}</p>}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {[{ key_name: 'all', label_fr: 'Tous', icon: '' }, ...cats].map(c => (
          <button key={c.key_name} onClick={() => setFilter(c.key_name)} style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid #E5E7EB', cursor: 'pointer',
            background: filter === c.key_name ? '#C2782A' : '#fff',
            color: filter === c.key_name ? '#fff' : '#374151',
            fontSize: '0.82rem', fontWeight: 600, fontFamily: 'Poppins,sans-serif',
          }}>
            {c.icon ? `${c.icon} ` : ''}{c.label_fr}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom (FR)</th><th>Catégorie</th><th>Téléphone</th><th>WhatsApp</th><th>24h/24</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#6B7280' }}>Aucun contact</td></tr>
            )}
            {filtered.map(it => (
              <tr key={it.id}>
                <td>
                  <strong>{it.translations?.fr?.name || '—'}</strong>
                  {it.translations?.fr?.description && (
                    <><br /><small style={{ color: '#9CA3AF' }}>{it.translations.fr.description}</small></>
                  )}
                </td>
                <td>{catLabel(it.category)}</td>
                <td style={{ fontSize: '0.85rem' }}>{it.phone || '—'}</td>
                <td style={{ fontSize: '0.85rem' }}>{it.whatsapp || '—'}</td>
                <td>
                  <span className={`${styles.badge} ${it.available_24h ? styles.badgeActive : styles.badgeInactive}`}>
                    {it.available_24h ? 'Oui' : 'Non'}
                  </span>
                </td>
                <td>
                  <span className={`${styles.badge} ${it.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                    {it.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
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
              <span className={styles.modalTitle}>
                {modal === 'create' ? 'Nouveau contact' : 'Modifier le contact'}
              </span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Catégorie</label>
                  <select className={styles.select} value={editing.category} onChange={e => set('category', e.target.value)}>
                    {cats.map(c => <option key={c.key_name} value={c.key_name}>{c.icon} {c.label_fr}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Ordre d'affichage</label>
                  <input className={styles.input} type="number" value={editing.display_order}
                    onChange={e => set('display_order', parseInt(e.target.value) || 0)} />
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Téléphone</label>
                  <input className={styles.input} value={editing.phone}
                    onChange={e => set('phone', e.target.value)} placeholder="+226 25 00 00 00" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>WhatsApp</label>
                  <input className={styles.input} value={editing.whatsapp}
                    onChange={e => set('whatsapp', e.target.value)} placeholder="+226 70 00 00 00" />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Site web</label>
                <input className={styles.input} value={editing.website}
                  onChange={e => set('website', e.target.value)} placeholder="https://..." />
              </div>

              <div style={{ display: 'flex', gap: 24 }}>
                <div className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={editing.available_24h}
                      onChange={e => set('available_24h', e.target.checked)} />
                    <span className={styles.toggleSlider} />
                  </label>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Disponible 24h/24</span>
                </div>
                <div className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={editing.is_active}
                      onChange={e => set('is_active', e.target.checked)} />
                    <span className={styles.toggleSlider} />
                  </label>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Contact actif</span>
                </div>
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
                  <label className={styles.label}>Nom</label>
                  <input className={styles.input} value={editing.translations[tab]?.name || ''}
                    onChange={e => setTr(tab, 'name', e.target.value)} placeholder="Ex: Taxi Ouaga" />
                </div>
                <div className={styles.field} style={{ marginTop: 12 }}>
                  <label className={styles.label}>Description courte</label>
                  <input className={styles.input} value={editing.translations[tab]?.description || ''}
                    onChange={e => setTr(tab, 'description', e.target.value)}
                    placeholder="Ex: Service fiable, disponible 7j/7" />
                </div>
                <div className={styles.field} style={{ marginTop: 12 }}>
                  <label className={styles.label}>Adresse</label>
                  <input className={styles.input} value={editing.translations[tab]?.address || ''}
                    onChange={e => setTr(tab, 'address', e.target.value)}
                    placeholder="Ex: Avenue Kwame Nkrumah, Ouagadougou" />
                </div>
              </div>

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
