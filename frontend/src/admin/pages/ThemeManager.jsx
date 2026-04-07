import React, { useState, useEffect } from 'react';
import api    from '../useAdminApi';
import styles from '../Admin.module.css';

const COLOR_FIELDS = [
  { key:'color_primary',      label:'Couleur principale',      hint:'Boutons, accents' },
  { key:'color_primary_dark', label:'Couleur principale foncée',hint:'Hover, ombres' },
  { key:'color_secondary',    label:'Couleur secondaire',       hint:'Or, titres' },
  { key:'color_accent',       label:'Couleur accent',           hint:'Alertes, badges' },
  { key:'color_bg_dark',      label:'Fond sombre (borne)',      hint:'Arrière-plan nuit' },
  { key:'color_bg_light',     label:'Fond clair',               hint:'Mode jour' },
];

const TEXT_FIELDS = [
  { key:'hotel_name',   label:'Nom de l\'hôtel',   placeholder:'ConnectBé' },
  { key:'font_primary', label:'Police principale',  placeholder:'Poppins' },
];

export default function ThemeManager() {
  const [config,      setConfig]      = useState({});
  const [saving,      setSaving]      = useState(false);
  const [msg,         setMsg]         = useState('');
  const [logoFile,    setLogoFile]    = useState(null);
  const [preview,     setPreview]     = useState(null);
  const [bannerFile,  setBannerFile]  = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  useEffect(() => {
    api.get('/theme').then(r => setConfig(r.data.config || {})).catch(() => {});
  }, []);

  const set = (key, val) => setConfig(c => ({ ...c, [key]: val }));

  const save = async () => {
    setSaving(true);
    try {
      // Sauvegarder les valeurs de config
      await api.put('/theme', { updates: config });

      // Upload logo si sélectionné
      if (logoFile) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        const { data } = await api.post('/theme/logo', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setConfig(c => ({ ...c, logo_url: data.url }));
        setLogoFile(null);
      }

      // Upload bannière si sélectionnée
      if (bannerFile) {
        const fd = new FormData();
        fd.append('banner', bannerFile);
        const { data } = await api.post('/theme/banner', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setConfig(c => ({ ...c, banner_image_url: data.url }));
        setBannerFile(null);
      }

      setMsg('✅ Thème mis à jour — rechargez la borne pour voir les changements');
    } catch { setMsg('❌ Erreur lors de la sauvegarde'); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 5000); }
  };

  const onLogoChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const onBannerChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Personnalisation du Thème</h2>
          <p className={styles.pageSubtitle}>Couleurs, nom, logo — modifications visibles sur la borne sans redéploiement</p>
        </div>
        <button className={styles.btnPrimary} onClick={save} disabled={saving}>
          {saving ? '⏳ Sauvegarde…' : '💾 Sauvegarder'}
        </button>
      </div>

      {msg && (
        <div style={{ padding:'12px 16px', borderRadius:10, marginBottom:24,
          background: msg.startsWith('✅') ? '#D1FAE5' : '#FEE2E2',
          color: msg.startsWith('✅') ? '#065F46' : '#991B1B', fontWeight:600 }}>
          {msg}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>

        {/* ── Informations générales ── */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:24 }}>
          <h3 style={{ fontWeight:800, marginBottom:20, fontSize:'1rem' }}>🏨 Informations générales</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {TEXT_FIELDS.map(f => (
              <div key={f.key} className={styles.field}>
                <label className={styles.label}>{f.label}</label>
                <input className={styles.input} value={config[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Logo ── */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:24 }}>
          <h3 style={{ fontWeight:800, marginBottom:20, fontSize:'1rem' }}>🖼 Logo de l'hôtel</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:16, alignItems:'center' }}>
            {(preview || config.logo_url) && (
              <img
                src={preview || config.logo_url}
                alt="Logo actuel"
                className={styles.uploadPreview}
                style={{ maxHeight:80, objectFit:'contain' }}
                onError={e => { e.target.style.display='none'; }}
              />
            )}
            <label className={styles.uploadZone} style={{ width:'100%' }}>
              <input type="file" accept="image/*" style={{ display:'none' }} onChange={onLogoChange} />
              {logoFile ? (
                <p style={{ fontWeight:600, color:'#C2782A' }}>✅ {logoFile.name} sélectionné</p>
              ) : (
                <>
                  <p style={{ fontSize:'1.4rem', marginBottom:6 }}>📁</p>
                  <p style={{ fontSize:'0.88rem', color:'#6B7280' }}>Cliquez pour sélectionner un logo</p>
                  <p style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:4 }}>PNG, JPG, SVG — max 2 Mo</p>
                </>
              )}
            </label>
            <div className={styles.field} style={{ width:'100%' }}>
              <label className={styles.label}>Ou entrer une URL directement</label>
              <input className={styles.input} value={config.logo_url || ''} onChange={e => set('logo_url', e.target.value)} placeholder="/images/logo.png" />
            </div>
          </div>
        </div>

        {/* ── Image bannière ── */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:24, gridColumn:'span 2' }}>
          <h3 style={{ fontWeight:800, marginBottom:20, fontSize:'1rem' }}>🖼 Image de fond (bannière accueil)</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, alignItems:'start' }}>
            {/* Aperçu */}
            <div>
              <p style={{ fontSize:'0.78rem', color:'#6B7280', marginBottom:8 }}>Aperçu actuel</p>
              <img
                src={bannerPreview || config.banner_image_url || ''}
                alt="Bannière"
                style={{ width:'100%', height:140, objectFit:'cover', borderRadius:10, border:'1px solid #E5E7EB', background:'#F3F4F6' }}
                onError={e => { e.target.style.display='none'; }}
              />
            </div>
            {/* Contrôles */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <label className={styles.uploadZone}>
                <input type="file" accept="image/*" style={{ display:'none' }} onChange={onBannerChange} />
                {bannerFile ? (
                  <p style={{ fontWeight:600, color:'#C2782A' }}>✅ {bannerFile.name} sélectionné</p>
                ) : (
                  <>
                    <p style={{ fontSize:'1.4rem', marginBottom:6 }}>📁</p>
                    <p style={{ fontSize:'0.88rem', color:'#6B7280' }}>Cliquez pour charger une image</p>
                    <p style={{ fontSize:'0.75rem', color:'#9CA3AF', marginTop:4 }}>JPG, PNG, WebP — max 5 Mo</p>
                  </>
                )}
              </label>
              <div className={styles.field}>
                <label className={styles.label}>Ou entrer un lien URL</label>
                <input
                  className={styles.input}
                  value={config.banner_image_url || ''}
                  onChange={e => set('banner_image_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ fontSize:'0.78rem' }}
                onClick={() => {
                  set('banner_image_url', 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=80');
                  setBannerFile(null); setBannerPreview(null);
                }}
              >
                ↺ Rétablir l'image par défaut
              </button>
            </div>
          </div>
        </div>

        {/* ── Couleurs ── */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:24, gridColumn:'span 2' }}>
          <h3 style={{ fontWeight:800, marginBottom:20, fontSize:'1rem' }}>🎨 Palette de couleurs</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:20 }}>
            {COLOR_FIELDS.map(f => (
              <div key={f.key} className={styles.field}>
                <label className={styles.label}>{f.label}</label>
                <p style={{ fontSize:'0.72rem', color:'#9CA3AF', marginBottom:6 }}>{f.hint}</p>
                <div className={styles.colorField}>
                  <div className={styles.colorSwatch}>
                    <input type="color" value={config[f.key] || '#C2782A'} onChange={e => set(f.key, e.target.value)} />
                  </div>
                  <input className={styles.input} value={config[f.key] || ''} onChange={e => set(f.key, e.target.value)} placeholder="#C2782A" style={{ flex:1 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sécurité borne ── */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:24, gridColumn:'span 2' }}>
          <h3 style={{ fontWeight:800, marginBottom:8, fontSize:'1rem' }}>🔒 Sécurité borne</h3>
          <p style={{ fontSize:'0.78rem', color:'#6B7280', marginBottom:16 }}>
            Mot de passe requis pour quitter le mode plein écran sur la borne publique.
          </p>
          <div className={styles.field} style={{ maxWidth:360 }}>
            <label className={styles.label}>Mot de passe plein écran</label>
            <input
              className={styles.input}
              type="text"
              value={config.fullscreen_password || ''}
              onChange={e => set('fullscreen_password', e.target.value)}
              placeholder="fs1234"
              autoComplete="off"
            />
          </div>
        </div>

        {/* ── Aperçu live ── */}
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E5E7EB', padding:24, gridColumn:'span 2' }}>
          <h3 style={{ fontWeight:800, marginBottom:16, fontSize:'1rem' }}>👁 Aperçu des couleurs</h3>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
            {COLOR_FIELDS.map(f => (
              <div key={f.key} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <div style={{ width:48, height:48, borderRadius:10, background: config[f.key] || '#ccc', border:'1px solid #E5E7EB' }} />
                <span style={{ fontSize:'0.68rem', color:'#6B7280', textAlign:'center', maxWidth:80 }}>{f.label}</span>
              </div>
            ))}
            <div style={{
              flex:1, minWidth:200, padding:'16px 20px', borderRadius:12,
              background: config.color_primary || '#C2782A', color:'#fff',
              fontFamily:'Poppins,sans-serif', fontWeight:700
            }}>
              {config.hotel_name || 'ConnectBé'}
              <p style={{ fontSize:'0.78rem', opacity:0.8, marginTop:4 }}>Votre concierge numérique</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
