// Super-admin — Configuration complète d'un hôtel
// Onglets : Paramètres | Bon à savoir | Météo | Aéroports
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../useAdminApi';
import TranslationPanel from '../../components/TranslationPanel';
import { useTranslate } from '../../hooks/useTranslate';
import { useToast } from '../../hooks/useToast';
import styles from '../../Admin.module.css';
import localesMeta from '../../../i18n/locales.json';

const ALL_LOCALES  = Object.keys(localesMeta);
const TIPS_TRANS_FIELDS = ['titre', 'contenu'];
const EXTRA_LOCALES = ALL_LOCALES.filter(l => l !== 'fr' && l !== 'en');

const TABS = [
  { key: 'settings', label: 'Paramètres'   },
  { key: 'tips',     label: 'Bon à savoir' },
  { key: 'weather',  label: 'Météo'        },
  { key: 'airports', label: 'Aéroports'   },
];

// ── Onglet Paramètres ────────────────────────────────────────────
function TabSettings({ hotelId }) {
  const [form,    setForm]    = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,          setToast]          = useState('');
  const [welcomeSrcLang, setWelcomeSrcLang] = useState('fr');
  const [bannerImages,   setBannerImages]   = useState([]);
  const [uploading,      setUploading]      = useState(false);
  const { translateFields, translating } = useTranslate();

  const params = { hotel_id: hotelId };

  useEffect(() => {
    api.get('/hotel/banner-images', { params })
      .then(r => setBannerImages(r.data || []))
      .catch(() => {});
  }, [hotelId]); // eslint-disable-line

  useEffect(() => {
    api.get('/hotel/settings', { params })
      .then(({ data }) => {
        setSettings(data);
        let theme = {};
        try { theme = JSON.parse(data.theme_colors || '{}'); } catch {}
        setForm({
          ...Object.fromEntries(ALL_LOCALES.map(l => [`welcome_message_${l}`, data[`welcome_message_${l}`] || ''])),
          contact_phone:      data.contact_phone || '',
          contact_email:      data.contact_email || '',
          wifi_name:          data.wifi_name || '',
          wifi_password:      data.wifi_password || '',
          checkin_time:       data.checkin_time || '',
          checkout_time:      data.checkout_time || '',
          primary_color:      theme.primary || '#C2782A',
          secondary_color:    theme.secondary || '#1A1005',
          adresse:            data.adresse || '',
          lat:                data.lat != null ? String(data.lat) : '',
          lng:                data.lng != null ? String(data.lng) : '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [hotelId]); // eslint-disable-line

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const uploadBannerImages = async (files) => {
    const fd = new FormData();
    Array.from(files).forEach(f => fd.append('images', f));
    setUploading(true);
    try {
      const { data } = await api.post('/hotel/banner-images', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, params,
      });
      setBannerImages(prev => [...prev, ...data]);
      showToast(`${data.length} image(s) ajoutée(s)`);
    } catch (err) { alert(err.response?.data?.error || 'Erreur upload'); }
    finally { setUploading(false); }
  };

  const deleteBannerImage = async (id) => {
    try {
      await api.delete(`/hotel/banner-images/${id}`, { params });
      setBannerImages(prev => prev.filter(img => img.id !== id));
    } catch (err) { alert(err.response?.data?.error || 'Erreur suppression'); }
  };

  const translateWelcomeAll = async () => {
    const sourceKey = `welcome_message_${welcomeSrcLang}`;
    if (!form[sourceKey]?.trim()) return;
    const result = await translateFields(
      ['welcome_message'],
      welcomeSrcLang,
      { welcome_message: form[sourceKey] },
      ALL_LOCALES,
    );
    const updates = {};
    for (const [locale, fields] of Object.entries(result)) {
      if (fields.welcome_message) updates[`welcome_message_${locale}`] = fields.welcome_message;
    }
    if (Object.keys(updates).length) {
      setForm(f => ({ ...f, ...updates }));
      showToast('Messages traduits automatiquement');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...Object.fromEntries(ALL_LOCALES.map(l => [`welcome_message_${l}`, form[`welcome_message_${l}`]])),
        contact_phone:      form.contact_phone,
        contact_email:      form.contact_email,
        wifi_name:          form.wifi_name,
        wifi_password:      form.wifi_password,
        checkin_time:       form.checkin_time,
        checkout_time:      form.checkout_time,
        theme_colors: JSON.stringify({
          primary:   form.primary_color,
          secondary: form.secondary_color,
        }),
        adresse: form.adresse,
      };
      if (form.lat !== '') payload.lat = parseFloat(form.lat);
      if (form.lng !== '') payload.lng = parseFloat(form.lng);
      await api.put('/hotel/settings', payload, { params });
      showToast('Paramètres enregistrés');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const uploadFile = async (field, file) => {
    const fd = new FormData();
    fd.append(field, file);
    try {
      const { data } = await api.post(`/hotel/settings/${field}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params,
      });
      setSettings(prev => ({ ...prev, ...data }));
      showToast(`${field === 'logo' ? 'Logo' : 'Image de fond'} mis à jour`);
    } catch (err) { alert(err.response?.data?.error || 'Erreur upload'); }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;
  if (!form)   return <div style={{ padding: '2rem', color: '#EF4444' }}>Impossible de charger les paramètres.</div>;

  return (
    <div>
      {toast && <div className={styles.toast}>{toast}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {/* Images & Branding */}
      <Section title="Images & Branding">
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Logo</label>
            <div className={styles.uploadZone} onClick={() => document.getElementById(`logo-input-${hotelId}`).click()}>
              {settings?.logo_url
                ? <img src={settings.logo_url} alt="logo" className={styles.uploadPreview} />
                : <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Cliquez pour choisir un logo</div>
              }
              <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 4 }}>JPG, PNG — max 5 Mo</div>
            </div>
            <input id={`logo-input-${hotelId}`} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => e.target.files[0] && uploadFile('logo', e.target.files[0])} />
          </div>
        </div>

        {/* Galerie de bannières */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label className={styles.label} style={{ margin: 0 }}>Galerie de bannières</label>
            <span style={{ fontSize: '0.78rem', color: bannerImages.length >= 10 ? '#EF4444' : '#9CA3AF', fontWeight: 600 }}>
              {bannerImages.length} / 10
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {bannerImages.map((img, i) => (
              <div key={img.id} style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', background: '#F3F4F6' }}>
                <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{ position: 'absolute', top: 4, left: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>
                  {i + 1}
                </span>
                <button
                  onClick={() => deleteBannerImage(img.id)}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', borderRadius: 4, cursor: 'pointer', padding: '2px 7px', fontSize: '0.8rem', lineHeight: 1 }}
                  title="Supprimer"
                >✕</button>
              </div>
            ))}
            {bannerImages.length < 10 && (
              <div
                onClick={() => document.getElementById(`banner-input-${hotelId}`).click()}
                style={{ aspectRatio: '16/9', borderRadius: 8, border: '2px dashed #D1D5DB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer', color: '#9CA3AF', gap: 4 }}
              >
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{uploading ? '…' : '+'}</span>
                <span style={{ fontSize: '0.65rem' }}>Ajouter</span>
              </div>
            )}
          </div>
          <input id={`banner-input-${hotelId}`} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { if (e.target.files.length) { uploadBannerImages(e.target.files); e.target.value = ''; } }} />
          <p style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 8 }}>
            JPG, PNG — max 5 Mo/image. Les images défilent toutes les 8 s sur le kiosque.
          </p>
        </div>
        <div className={styles.fieldRow} style={{ marginTop: 16 }}>
          <div className={styles.field}>
            <label className={styles.label}>Couleur principale</label>
            <div className={styles.colorField}>
              <div className={styles.colorSwatch}>
                <input type="color" value={form.primary_color || '#C2782A'}
                  onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} />
              </div>
              <input className={styles.input} value={form.primary_color || ''}
                onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} style={{ flex: 1 }} />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Couleur secondaire</label>
            <div className={styles.colorField}>
              <div className={styles.colorSwatch}>
                <input type="color" value={form.secondary_color || '#1A1005'}
                  onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} />
              </div>
              <input className={styles.input} value={form.secondary_color || ''}
                onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} style={{ flex: 1 }} />
            </div>
          </div>
        </div>
      </Section>

      {/* Messages d'accueil */}
      <Section title="Message d'accueil">
        <TranslationPanel
          sourceLang={welcomeSrcLang}
          onSourceChange={setWelcomeSrcLang}
          allLocales={ALL_LOCALES}
          onTranslateAll={translateWelcomeAll}
          translating={translating}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {ALL_LOCALES.map(l => (
            <div key={l} className={styles.field}>
              <label className={styles.label}>
                {localesMeta[l]?.flag} {localesMeta[l]?.nativeName}
              </label>
              <textarea
                className={styles.textarea}
                value={form[`welcome_message_${l}`] || ''}
                dir={localesMeta[l]?.dir || 'ltr'}
                onChange={e => setForm(f => ({ ...f, [`welcome_message_${l}`]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Localisation */}
      <Section title="Localisation">
        <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: 16, marginTop: -8 }}>
          Utilisée pour centrer la carte du kiosque et calculer les distances jusqu'aux points d'intérêt.
          Obtenez les coordonnées depuis{' '}
          <a href="https://maps.google.com" target="_blank" rel="noreferrer" style={{ color: '#C2782A' }}>
            Google Maps
          </a>{' '}
          (clic droit → "Copier les coordonnées").
        </p>
        <div className={styles.field}>
          <label className={styles.label}>Adresse</label>
          <input
            className={styles.input}
            value={form.adresse}
            placeholder="Ex : Avenue Kwamé N'Krumah, Ouagadougou, Burkina Faso"
            onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
          />
        </div>
        <div className={styles.fieldRow} style={{ marginTop: 12 }}>
          <div className={styles.field}>
            <label className={styles.label}>Latitude</label>
            <input
              className={styles.input}
              type="number"
              step="0.000001"
              value={form.lat}
              placeholder="Ex : 12.364100"
              onChange={e => setForm(f => ({ ...f, lat: e.target.value }))}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Longitude</label>
            <input
              className={styles.input}
              type="number"
              step="0.000001"
              value={form.lng}
              placeholder="Ex : -1.533200"
              onChange={e => setForm(f => ({ ...f, lng: e.target.value }))}
            />
          </div>
        </div>
        {form.lat && form.lng && (
          <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: 8 }}>
            Aperçu :{' '}
            <a
              href={`https://www.google.com/maps?q=${form.lat},${form.lng}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#C2782A' }}
            >
              Voir sur Google Maps
            </a>
          </p>
        )}
      </Section>

      {/* Infos pratiques */}
      <Section title="Informations pratiques">
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Téléphone réception</label>
            <input className={styles.input} value={form.contact_phone}
              onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email contact</label>
            <input className={styles.input} type="email" value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
          </div>
        </div>
        <div className={styles.fieldRow} style={{ marginTop: 12 }}>
          <div className={styles.field}>
            <label className={styles.label}>WiFi — Nom du réseau</label>
            <input className={styles.input} value={form.wifi_name}
              onChange={e => setForm(f => ({ ...f, wifi_name: e.target.value }))} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>WiFi — Mot de passe</label>
            <input className={styles.input} value={form.wifi_password}
              onChange={e => setForm(f => ({ ...f, wifi_password: e.target.value }))} />
          </div>
        </div>
        <div className={styles.fieldRow} style={{ marginTop: 12 }}>
          <div className={styles.field}>
            <label className={styles.label}>Heure check-in</label>
            <input className={styles.input} type="time" value={form.checkin_time}
              onChange={e => setForm(f => ({ ...f, checkin_time: e.target.value }))} />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Heure check-out</label>
            <input className={styles.input} type="time" value={form.checkout_time}
              onChange={e => setForm(f => ({ ...f, checkout_time: e.target.value }))} />
          </div>
        </div>
      </Section>
    </div>
  );
}

// ── Onglet Bon à savoir ──────────────────────────────────────────

function initTrans(tip) {
  const map = {};
  for (const locale of ALL_LOCALES) {
    if (tip) {
      const found = tip.translations?.find(t => t.locale === locale);
      map[locale] = {
        titre:   found?.titre   || (locale === 'fr' ? tip.titre_fr  || '' : locale === 'en' ? tip.titre_en  || '' : ''),
        contenu: found?.contenu || (locale === 'fr' ? tip.contenu_fr || '' : locale === 'en' ? tip.contenu_en || '' : ''),
      };
    } else {
      map[locale] = { titre: '', contenu: '' };
    }
  }
  return map;
}

function TipFormModal({ tip, hotelId, onClose, onSaved }) {
  const isEdit = !!tip;
  const [trans,      setTrans]      = useState(() => initTrans(tip));
  const [activeLang, setActiveLang] = useState('fr');
  const [sourceLang, setSourceLang] = useState('fr');
  const [categorie,  setCategorie]  = useState(tip?.categorie || '');
  const [order,      setOrder]      = useState(tip?.display_order ?? 0);
  const [saving,     setSaving]     = useState(false);

  const { translateFields, translating } = useTranslate();

  const setLangVal = (locale, key, value) =>
    setTrans(prev => ({ ...prev, [locale]: { ...prev[locale], [key]: value } }));

  const handleTranslateAll = async () => {
    const result = await translateFields(TIPS_TRANS_FIELDS, sourceLang, trans[sourceLang], ALL_LOCALES);
    setTrans(prev => {
      const updated = { ...prev };
      for (const [locale, fields] of Object.entries(result)) {
        updated[locale] = { ...updated[locale], ...fields };
      }
      return updated;
    });
  };

  const save = async () => {
    if (!trans.fr.titre.trim() || !trans.fr.contenu.trim()) return;
    setSaving(true);
    try {
      const translations_extra = {};
      for (const locale of EXTRA_LOCALES) {
        if (trans[locale].titre?.trim() || trans[locale].contenu?.trim()) {
          translations_extra[locale] = { titre: trans[locale].titre, contenu: trans[locale].contenu };
        }
      }
      const payload = {
        titre_fr: trans.fr.titre, contenu_fr: trans.fr.contenu,
        titre_en: trans.en.titre || null, contenu_en: trans.en.contenu || null,
        categorie: categorie || null, display_order: order, translations_extra,
      };
      if (isEdit) {
        await api.put(`/hotel/tips/${tip.id}`, payload, { params: { hotel_id: hotelId } });
      } else {
        await api.post('/hotel/tips', payload, { params: { hotel_id: hotelId } });
      }
      onSaved();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const curTrans = trans[activeLang] || { titre: '', contenu: '' };
  const langMeta = localesMeta[activeLang] || {};

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {isEdit ? `Modifier — ${tip.titre_fr}` : 'Nouveau conseil'}
          </span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Catégorie</label>
              <input className={styles.input} value={categorie}
                placeholder="ex: Sécurité, Santé…"
                onChange={e => setCategorie(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ordre d'affichage</label>
              <input className={styles.input} type="number" value={order}
                onChange={e => setOrder(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div className={styles.tabs}>
            {ALL_LOCALES.map(l => {
              const m = localesMeta[l] || {};
              const filled = trans[l].titre?.trim();
              return (
                <button key={l}
                  className={`${styles.tab} ${activeLang === l ? styles.tabActive : ''}`}
                  onClick={() => setActiveLang(l)}
                  style={{ gap: 4, display: 'flex', alignItems: 'center' }}>
                  {m.flag} {m.nativeName}
                  {filled && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', marginLeft: 3 }} />}
                </button>
              );
            })}
          </div>
          <div key={activeLang}>
            <div className={styles.field}>
              <label className={styles.label}>{langMeta.flag} Titre{activeLang === 'fr' ? ' *' : ''}</label>
              <input className={styles.input} value={curTrans.titre}
                onChange={e => setLangVal(activeLang, 'titre', e.target.value)}
                autoFocus={activeLang === 'fr'} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{langMeta.flag} Contenu{activeLang === 'fr' ? ' *' : ''}</label>
              <textarea className={styles.textarea} rows={4} value={curTrans.contenu}
                onChange={e => setLangVal(activeLang, 'contenu', e.target.value)} />
            </div>
          </div>
          <TranslationPanel
            sourceLang={sourceLang}
            onSourceChange={setSourceLang}
            allLocales={ALL_LOCALES}
            onTranslateAll={handleTranslateAll}
            translating={translating}
          />
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={save}
            disabled={saving || !trans.fr.titre.trim() || !trans.fr.contenu.trim()}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabTips({ hotelId }) {
  const [tips,    setTips]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);
  const [toast,   showToast]  = useToast();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/hotel/tips', { params: { hotel_id: hotelId } });
      setTips(data);
    } finally { setLoading(false); }
  }, [hotelId]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (t) => {
    await api.put(`/hotel/tips/${t.id}`, { is_active: t.is_active ? 0 : 1 }, { params: { hotel_id: hotelId } });
    showToast(t.is_active ? 'Conseil désactivé' : 'Conseil activé');
    load();
  };

  const del = async (id, titre) => {
    if (!window.confirm(`Supprimer "${titre}" ?`)) return;
    await api.delete(`/hotel/tips/${id}`, { params: { hotel_id: hotelId } });
    showToast('Conseil supprimé');
    load();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      {toast && <div className={styles.toast}>{toast}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className={styles.btnPrimary} onClick={() => setModal('create')}>+ Ajouter un conseil</button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Titre (FR)</th><th>Catégorie</th><th>Langues</th><th>Ordre</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {tips.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>💡</div><div className={styles.emptyText}>Aucun conseil</div></div></td></tr>
            ) : tips.map(t => {
              const langs = (t.translations || []).filter(tr => tr.titre?.trim()).map(tr => localesMeta[tr.locale]?.flag || tr.locale);
              return (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.titre_fr}</td>
                  <td style={{ color: '#6B7280' }}>{t.categorie || '—'}</td>
                  <td style={{ fontSize: '1rem', letterSpacing: 2 }}>{langs.join(' ') || '—'}</td>
                  <td>{t.display_order}</td>
                  <td>
                    <span className={`${styles.badge} ${t.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                      {t.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.tdActions}>
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => setModal(t)}>Modifier</button>
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => toggleActive(t)}>{t.is_active ? 'Désactiver' : 'Activer'}</button>
                      <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => del(t.id, t.titre_fr)}>Supprimer</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <TipFormModal
          tip={modal === 'create' ? null : modal}
          hotelId={hotelId}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            showToast(modal === 'create' ? 'Conseil créé' : 'Conseil mis à jour');
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Onglet Météo ─────────────────────────────────────────────────
function TabWeather({ hotelId, hotelNom }) {
  const [localities, setLocalities] = useState([]);
  const [hotelLocs,  setHotelLocs]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [addForm,    setAddForm]    = useState({ locality_id: '', is_default: false });
  const [toast,      setToast]      = useState('');

  const load = useCallback(async () => {
    try {
      const [{ data: locs }, { data: hl }] = await Promise.all([
        api.get('/super/weather/localities'),
        api.get(`/super/weather/hotels/${hotelId}`),
      ]);
      setLocalities(locs);
      setHotelLocs(hl);
    } finally { setLoading(false); }
  }, [hotelId]);

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const addLocality = async () => {
    if (!addForm.locality_id) return;
    try {
      const { data } = await api.post(`/super/weather/hotels/${hotelId}`, {
        locality_id: parseInt(addForm.locality_id),
        is_default: addForm.is_default,
      });
      setHotelLocs(data);
      setAddForm({ locality_id: '', is_default: false });
      showToast('Localité ajoutée');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const removeLocality = async (localityId) => {
    try {
      await api.delete(`/super/weather/hotels/${hotelId}/${localityId}`);
      setHotelLocs(prev => prev.filter(l => l.locality_id !== localityId));
      showToast('Localité retirée');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const setDefault = async (localityId) => {
    try {
      await api.put(`/super/weather/hotels/${hotelId}/${localityId}/default`, {});
      setHotelLocs(prev => prev.map(l => ({ ...l, is_default: l.locality_id === localityId ? 1 : 0 })));
      showToast('Localité par défaut mise à jour');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const refreshWeather = async (localityId) => {
    try {
      await api.post(`/super/weather/refresh/${localityId}`, {});
      showToast('Météo rafraîchie');
    } catch (err) { alert(err.response?.data?.error || 'Erreur refresh météo'); }
  };

  const assigned  = hotelLocs.map(l => l.locality_id);
  const available = localities.filter(l => !assigned.includes(l.id));

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      {toast && <div className={styles.toast}>{toast}</div>}
      <Section title={`Localités météo — ${hotelNom} (${hotelLocs.length}/5 max)`}>
        <table className={styles.table}>
          <thead><tr><th>Localité</th><th>Pays</th><th>Défaut</th><th>Actions</th></tr></thead>
          <tbody>
            {hotelLocs.length === 0 ? (
              <tr><td colSpan={4}><div className={styles.empty}><div className={styles.emptyText}>Aucune localité météo configurée</div></div></td></tr>
            ) : hotelLocs.map(l => (
              <tr key={l.locality_id}>
                <td style={{ fontWeight: 600 }}>{l.name}</td>
                <td style={{ color: '#6B7280' }}>{l.country}</td>
                <td>{l.is_default ? <span className={`${styles.badge} ${styles.badgeFeatured}`}>Défaut</span> : '—'}</td>
                <td>
                  <div className={styles.tdActions}>
                    {!l.is_default && (
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => setDefault(l.locality_id)}>Défaut</button>
                    )}
                    <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => refreshWeather(l.locality_id)}>↻ Refresh</button>
                    <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => removeLocality(l.locality_id)}>Retirer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hotelLocs.length < 5 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 16 }}>
            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label}>Ajouter une localité</label>
              <select className={styles.select} value={addForm.locality_id}
                onChange={e => setAddForm(f => ({ ...f, locality_id: e.target.value }))}>
                <option value="">— Sélectionner —</option>
                {available.map(l => <option key={l.id} value={l.id}>{l.name} ({l.country})</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem',
              cursor: 'pointer', paddingBottom: 10 }}>
              <input type="checkbox" checked={addForm.is_default}
                onChange={e => setAddForm(f => ({ ...f, is_default: e.target.checked }))} />
              Défaut
            </label>
            <button className={styles.btnPrimary} onClick={addLocality}
              disabled={!addForm.locality_id} style={{ paddingBottom: 10 }}>
              Ajouter
            </button>
          </div>
        )}
        {available.length === 0 && hotelLocs.length < 5 && (
          <p style={{ color: '#9CA3AF', fontSize: '0.82rem', marginTop: 8 }}>
            Toutes les localités disponibles sont déjà assignées.
          </p>
        )}
      </Section>
    </div>
  );
}

// ── Onglet Aéroports ─────────────────────────────────────────────
function TabAirports({ hotelId, hotelNom }) {
  const [airports,  setAirports]  = useState([]);
  const [assigned,  setAssigned]  = useState([]); // codes des aéroports déjà affectés
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/super/airports');
      setAirports(data);
      // Extraire les aéroports déjà affectés à cet hôtel
      const codes = data
        .filter(ap => ap.hotels?.some(h => h.hotel_id === parseInt(hotelId)))
        .map(ap => ap.code);
      setAssigned(codes);
    } finally { setLoading(false); }
  }, [hotelId]);

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const assign = async (code) => {
    try {
      await api.post(`/super/airports/${code}/assign`, { hotel_id: parseInt(hotelId) });
      setAssigned(prev => [...prev, code]);
      showToast(`${code} affecté à ${hotelNom}`);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const unassign = async (code) => {
    try {
      await api.delete(`/super/airports/${code}/assign/${hotelId}`);
      setAssigned(prev => prev.filter(c => c !== code));
      showToast(`${code} retiré de ${hotelNom}`);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      {toast && <div className={styles.toast}>{toast}</div>}
      <Section title={`Aéroports affectés à ${hotelNom}`}>
        {airports.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✈️</div>
            <div className={styles.emptyText}>Aucun aéroport configuré dans le système</div>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>Code</th><th>Aéroport</th><th>Planification</th><th>Affecté</th><th>Action</th></tr>
            </thead>
            <tbody>
              {airports.map(ap => {
                const isAssigned = assigned.includes(ap.code);
                return (
                  <tr key={ap.code}>
                    <td><strong>{ap.code}</strong></td>
                    <td>{ap.label}</td>
                    <td>
                      {ap.schedule_enabled
                        ? <span className={`${styles.badge} ${styles.badgeActive}`}>
                            {ap.schedule_mode === 'interval'
                              ? `Toutes les ${ap.interval_minutes} min`
                              : 'Heures fixes'}
                          </span>
                        : <span className={`${styles.badge} ${styles.badgeInactive}`}>Manuel</span>
                      }
                    </td>
                    <td>
                      {isAssigned
                        ? <span className={`${styles.badge} ${styles.badgeActive}`}>Oui</span>
                        : <span style={{ color: '#9CA3AF', fontSize: '0.82rem' }}>—</span>
                      }
                    </td>
                    <td>
                      {isAssigned
                        ? <button className={styles.btnDanger} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                            onClick={() => unassign(ap.code)}>Retirer</button>
                        : <button className={styles.btnPrimary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                            onClick={() => assign(ap.code)}>Affecter</button>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

// ── Composant Section ─────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginBottom: 20 }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────
export default function HotelConfig() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const [hotel,     setHotel]    = useState(null);
  const [tab,       setTab]      = useState('settings');
  const [loading,   setLoading]  = useState(true);

  useEffect(() => {
    api.get(`/super/hotels/${id}`)
      .then(({ data }) => setHotel(data))
      .catch(() => navigate('/admin/super/hotels'))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;
  if (!hotel)  return null;

  return (
    <div>
      {/* En-tête */}
      <div className={styles.managerHeader}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => navigate('/admin/super/hotels')}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: '#6B7280', fontSize: '0.88rem', padding: 0, fontFamily: 'Poppins, sans-serif' }}>
              ← Hôtels
            </button>
            <span style={{ color: '#D1D5DB' }}>/</span>
            <h1 className={styles.managerTitle} style={{ margin: 0 }}>
              {hotel.nom}
            </h1>
            <span className={`${styles.badge} ${hotel.is_active ? styles.badgeActive : styles.badgeInactive}`}>
              {hotel.is_active ? 'Actif' : 'Inactif'}
            </span>
          </div>
          <p className={styles.managerSub}>Configuration de l'hôtel — slug : {hotel.slug}</p>
        </div>
        <a href={`/${hotel.slug}`} target="_blank" rel="noreferrer"
          className={styles.btnSecondary}
          style={{ padding: '8px 16px', fontSize: '0.85rem', textDecoration: 'none' }}>
          Aperçu kiosque
        </a>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #E5E7EB', marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '10px 24px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontFamily: 'Poppins, sans-serif',
              fontSize: '0.9rem',
              fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#C2782A' : '#6B7280',
              borderBottom: tab === t.key ? '2px solid #C2782A' : '2px solid transparent',
              marginBottom: -2,
              transition: 'color 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu onglet */}
      {tab === 'settings' && <TabSettings hotelId={id} />}
      {tab === 'tips'     && <TabTips     hotelId={id} />}
      {tab === 'weather'  && <TabWeather  hotelId={id} hotelNom={hotel.nom} />}
      {tab === 'airports' && <TabAirports hotelId={id} hotelNom={hotel.nom} />}
    </div>
  );
}
