import React, { useEffect, useState } from 'react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperHotelId } from '../../components/SuperHotelSelector';
import { useTranslate } from '../../hooks/useTranslate';
import TranslationPanel from '../../components/TranslationPanel';
import localesMeta from '../../../i18n/locales.json';
import styles from '../../Admin.module.css';

const ALL_LOCALES = Object.keys(localesMeta);

const CURATED_FONTS = [
  { value: 'Poppins',            category: 'Sans-serif' },
  { value: 'Lato',               category: 'Sans-serif' },
  { value: 'Montserrat',         category: 'Sans-serif' },
  { value: 'Open Sans',          category: 'Sans-serif' },
  { value: 'Raleway',            category: 'Sans-serif' },
  { value: 'Inter',              category: 'Sans-serif' },
  { value: 'Nunito',             category: 'Sans-serif' },
  { value: 'Playfair Display',   category: 'Serif'      },
  { value: 'Merriweather',       category: 'Serif'      },
  { value: 'Cormorant Garamond', category: 'Serif'      },
];

export default function HotelSettings() {
  const { user } = useAuth();
  const hotelId  = useSuperHotelId(user);
  const params   = hotelId ? { hotel_id: hotelId } : {};

  const [settings,      setSettings]      = useState(null);
  const [form,          setForm]          = useState({});
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState('');
  const [welcomeSrcLang, setWelcomeSrcLang] = useState('fr');
  const [bannerImages,  setBannerImages]  = useState([]);
  const [uploading,     setUploading]     = useState(false);
  const [fontUploading, setFontUploading] = useState(false);
  const { translateFields, translating } = useTranslate();

  useEffect(() => {
    if (hotelId !== undefined) {
      api.get('/hotel/banner-images', { params })
        .then(r => setBannerImages(r.data || []))
        .catch(() => {});
    }
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
          font_primary:       data.font_primary   || 'Poppins',
          font_secondary:     data.font_secondary || 'Playfair Display',
          font_file_url:      data.font_file_url  || '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

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
      await api.put('/hotel/settings', {
        ...Object.fromEntries(ALL_LOCALES.map(l => [`welcome_message_${l}`, form[`welcome_message_${l}`]])),
        contact_phone:      form.contact_phone,
        contact_email:      form.contact_email,
        wifi_name:          form.wifi_name,
        wifi_password:      form.wifi_password,
        checkin_time:       form.checkin_time,
        checkout_time:      form.checkout_time,
        font_primary:       form.font_primary,
        font_secondary:     form.font_secondary,
        theme_colors: JSON.stringify({
          primary:   form.primary_color,
          secondary: form.secondary_color,
        }),
      }, { params });
      showToast('Paramètres enregistrés');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const uploadFont = async (file) => {
    const fd = new FormData();
    fd.append('font', file);
    setFontUploading(true);
    try {
      const { data } = await api.post('/hotel/settings/font', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, params,
      });
      setSettings(prev => ({ ...prev, font_file_url: data.font_file_url }));
      setForm(f => ({ ...f, font_file_url: data.font_file_url }));
      showToast('Police personnalisée uploadée');
    } catch (err) { alert(err.response?.data?.error || 'Erreur upload police'); }
    finally { setFontUploading(false); }
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

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Paramètres hôtel</h1>
          <p className={styles.managerSub}>Branding, accueil et informations pratiques</p>
        </div>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Images */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Images & Branding</h2>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Logo</label>
            <div className={styles.uploadZone} onClick={() => document.getElementById('logo-input').click()}>
              {settings?.logo_url
                ? <img src={settings.logo_url} alt="logo" className={styles.uploadPreview} />
                : <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Cliquez pour choisir un logo</div>
              }
              <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 4 }}>JPG, PNG — max 5 Mo</div>
            </div>
            <input id="logo-input" type="file" accept="image/*" style={{ display: 'none' }}
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
                onClick={() => document.getElementById('banner-input').click()}
                style={{ aspectRatio: '16/9', borderRadius: 8, border: '2px dashed #D1D5DB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'wait' : 'pointer', color: '#9CA3AF', gap: 4 }}
              >
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{uploading ? '…' : '+'}</span>
                <span style={{ fontSize: '0.65rem' }}>Ajouter</span>
              </div>
            )}
          </div>
          <input id="banner-input" type="file" accept="image/*" multiple style={{ display: 'none' }}
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
      </div>

      {/* Typographie */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Typographie</h2>
        <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: 16 }}>
          Polices affichées sur le kiosque et utilisées dans les exports PDF.
        </p>

        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.label}>Police principale (corps)</label>
            <select
              className={styles.input}
              value={form.font_primary || 'Poppins'}
              onChange={e => setForm(f => ({ ...f, font_primary: e.target.value }))}
            >
              {CURATED_FONTS.map(f => (
                <option key={f.value} value={f.value}>{f.value} — {f.category}</option>
              ))}
            </select>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#9CA3AF', fontFamily: `'${form.font_primary}', sans-serif` }}>
              Aperçu : L'hôtel vous souhaite la bienvenue — Welcome
            </p>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Police secondaire (titres)</label>
            <select
              className={styles.input}
              value={form.font_secondary || 'Playfair Display'}
              onChange={e => setForm(f => ({ ...f, font_secondary: e.target.value }))}
            >
              {CURATED_FONTS.map(f => (
                <option key={f.value} value={f.value}>{f.value} — {f.category}</option>
              ))}
            </select>
            <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#9CA3AF', fontFamily: `'${form.font_secondary}', serif` }}>
              Aperçu : L'hôtel vous souhaite la bienvenue — Welcome
            </p>
          </div>
        </div>

        <div className={styles.field} style={{ marginTop: 16 }}>
          <label className={styles.label}>Police personnalisée (.ttf / .otf / .woff / .woff2)</label>
          <p style={{ fontSize: '0.78rem', color: '#6B7280', margin: '0 0 8px' }}>
            Uploadez le fichier de la police de votre charte graphique. Elle remplacera la police principale sur le kiosque et dans les PDFs.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className={styles.btnSecondary}
              onClick={() => document.getElementById('font-input').click()}
              disabled={fontUploading}
              style={{ fontSize: '0.85rem' }}
            >
              {fontUploading ? 'Upload…' : '📁 Choisir un fichier'}
            </button>
            {form.font_file_url && (
              <span style={{ fontSize: '0.8rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                ✓ {form.font_file_url.split('/').pop()}
                <button
                  onClick={() => {
                    setForm(f => ({ ...f, font_file_url: '' }));
                    api.put('/hotel/settings', { font_file_url: null }, { params }).catch(() => {});
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '0.8rem', padding: '0 2px' }}
                  title="Supprimer la police personnalisée"
                >✕</button>
              </span>
            )}
          </div>
          <input id="font-input" type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) { uploadFont(e.target.files[0]); e.target.value = ''; } }} />
        </div>
      </div>

      {/* Messages d'accueil */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>Message d'accueil</h2>
        <p style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: 16 }}>
          Affiché dans la bannière principale du kiosque, dans la langue du visiteur.
        </p>
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
      </div>

      {/* Infos pratiques */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Informations pratiques</h2>
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
      </div>
    </div>
  );
}
