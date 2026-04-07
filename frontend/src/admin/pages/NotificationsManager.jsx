import React, { useState, useEffect, useCallback } from 'react';
import api          from '../useAdminApi';
import styles       from '../Admin.module.css';
import localesMeta  from '../../i18n/locales.json';
import { useTranslate } from '../hooks/useTranslate';

const ALL_LOCALES = Object.keys(localesMeta);

const EMPTY = () => ({
  ...Object.fromEntries(ALL_LOCALES.map(l => [`message_${l}`, ''])),
  is_active: true,
  display_order: 0,
});

export default function NotificationsManager() {
  const [items,   setItems]   = useState([]);
  const [modal,   setModal]   = useState(null);
  const [editing, setEditing] = useState(EMPTY());
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [tab,     setTab]     = useState('fr');

  const { translateFields, translating } = useTranslate();

  const load = useCallback(() =>
    api.get('/notifications').then(r => setItems(r.data)).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(EMPTY()); setModal('create'); setTab('fr'); };
  const openEdit   = item => {
    setEditing({
      ...EMPTY(),
      ...Object.fromEntries(ALL_LOCALES.map(l => [`message_${l}`, item[`message_${l}`] || ''])),
      id:            item.id,
      is_active:     !!item.is_active,
      display_order: item.display_order,
    });
    setModal('edit');
    setTab('fr');
  };

  const handleTranslateAll = async () => {
    const sourceText = editing[`message_${tab}`];
    if (!sourceText?.trim()) {
      setMsg('⚠️ Saisissez le message dans l\'onglet actif avant de traduire.');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    const result = await translateFields(['message'], tab, { message: sourceText }, ALL_LOCALES);
    setEditing(e => {
      const updated = { ...e };
      for (const [locale, vals] of Object.entries(result)) {
        if (vals.message) updated[`message_${locale}`] = vals.message;
      }
      return updated;
    });
    setMsg('✅ Traduction automatique appliquée — vérifiez les onglets.');
    setTimeout(() => setMsg(''), 5000);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') await api.post('/notifications', editing);
      else                    await api.put(`/notifications/${editing.id}`, editing);
      setMsg('✅ Enregistré'); load(); setModal(null);
    } catch { setMsg('❌ Erreur'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const del = async id => {
    if (!confirm('Supprimer cette notification ?')) return;
    await api.delete(`/notifications/${id}`).catch(() => {});
    load();
  };

  const set = (f, v) => setEditing(e => ({ ...e, [f]: v }));

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Bon à savoir</h2>
          <p className={styles.pageSubtitle}>Messages affichés sur l'écran d'accueil de la borne</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Nouvelle notification</button>
      </div>

      {msg && <p style={{ marginBottom:16, fontWeight:600 }}>{msg}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Message (FR)</th><th>Message (EN)</th><th>Autres langues</th><th>Ordre</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:32, color:'#6B7280' }}>Aucune notification</td></tr>
            )}
            {items.map(it => (
              <tr key={it.id}>
                <td style={{ maxWidth:220 }}>{it.message_fr}</td>
                <td style={{ maxWidth:220, color:'#6B7280', fontSize:'0.85rem' }}>{it.message_en || '—'}</td>
                <td style={{ fontSize:'0.8rem', color:'#9CA3AF' }}>
                  {ALL_LOCALES.filter(l => l !== 'fr' && l !== 'en' && it[`message_${l}`])
                    .map(l => localesMeta[l]?.flag)
                    .join(' ') || '—'}
                </td>
                <td>{it.display_order}</td>
                <td><span className={`${styles.badge} ${it.is_active ? styles.badgeActive : styles.badgeInactive}`}>{it.is_active ? 'Active' : 'Inactive'}</span></td>
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
          <div className={styles.modal} style={{ maxWidth: 560 }}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal==='create' ? 'Nouvelle notification' : 'Modifier'}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>

              {/* Onglets langues */}
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:12 }}>
                {ALL_LOCALES.map(l => (
                  <button
                    key={l}
                    onClick={() => setTab(l)}
                    className={tab === l ? styles.btnPrimary : styles.btnSecondary}
                    style={{ padding:'4px 10px', fontSize:'0.85rem' }}
                  >
                    {localesMeta[l]?.flag} {l.toUpperCase()}
                    {editing[`message_${l}`] ? ' ✓' : ''}
                  </button>
                ))}
                <button
                  className={styles.btnSecondary}
                  style={{ padding:'4px 10px', fontSize:'0.85rem', marginLeft:'auto' }}
                  onClick={handleTranslateAll}
                  disabled={translating}
                  title={`Traduire depuis l'onglet actif (${tab.toUpperCase()}) vers toutes les autres langues`}
                >
                  {translating ? '⏳ Traduction…' : '🌐 Traduire depuis ce tab'}
                </button>
              </div>

              {/* Champ message pour la langue active */}
              <div className={styles.field}>
                <label className={styles.label}>
                  {localesMeta[tab]?.flag} Message en {localesMeta[tab]?.nativeName}
                </label>
                <textarea
                  className={styles.textarea}
                  value={editing[`message_${tab}`]}
                  onChange={e => set(`message_${tab}`, e.target.value)}
                  placeholder="Ex: Cocktail de bienvenue ce soir à 18h"
                  rows={3}
                  dir={localesMeta[tab]?.dir || 'ltr'}
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Ordre d'affichage</label>
                  <input className={styles.input} type="number" value={editing.display_order} onChange={e => set('display_order', +e.target.value)} />
                </div>
                <div className={styles.field} style={{ justifyContent:'flex-end' }}>
                  <label className={styles.label}>Notification active</label>
                  <label className={styles.toggle} style={{ marginTop:4 }}>
                    <input type="checkbox" checked={editing.is_active} onChange={e => set('is_active', e.target.checked)} />
                    <span className={styles.toggleSlider} />
                  </label>
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
