import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

export default function HotelSettings() {
  const { user }   = useAuth();
  const [settings, setSettings] = useState(null);
  const [form,     setForm]     = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  useEffect(() => {
    axios.get('/api/admin/hotel/settings', { headers })
      .then(({ data }) => {
        setSettings(data);
        let theme = {};
        try { theme = JSON.parse(data.theme_colors || '{}'); } catch {}
        setForm({
          welcome_message_fr: data.welcome_message_fr || '',
          welcome_message_en: data.welcome_message_en || '',
          contact_phone:      data.contact_phone || '',
          contact_email:      data.contact_email || '',
          wifi_name:          data.wifi_name || '',
          wifi_password:      data.wifi_password || '',
          checkin_time:       data.checkin_time || '',
          checkout_time:      data.checkout_time || '',
          primary_color:      theme.primary || '#C2782A',
          secondary_color:    theme.secondary || '#1A1005',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const save = async () => {
    setSaving(true);
    try {
      await axios.put('/api/admin/hotel/settings', {
        welcome_message_fr: form.welcome_message_fr,
        welcome_message_en: form.welcome_message_en,
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
      }, { headers });
      showToast('Paramètres enregistrés');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const uploadFile = async (field, file) => {
    const fd = new FormData();
    fd.append(field, file);
    try {
      const { data } = await axios.post(`/api/admin/hotel/settings/${field}`, fd, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
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
          <div className={styles.field}>
            <label className={styles.label}>Image de fond</label>
            <div className={styles.uploadZone} onClick={() => document.getElementById('bg-input').click()}>
              {settings?.background_url
                ? <img src={settings.background_url} alt="fond" className={styles.uploadPreview} />
                : <div style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Cliquez pour choisir une image</div>
              }
              <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 4 }}>JPG, PNG — max 5 Mo</div>
            </div>
            <input id="bg-input" type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => e.target.files[0] && uploadFile('background', e.target.files[0])} />
          </div>
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

      {/* Messages d'accueil */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Message d'accueil</h2>
        <div className={styles.field}>
          <label className={styles.label}>Français</label>
          <textarea className={styles.textarea} value={form.welcome_message_fr}
            onChange={e => setForm(f => ({ ...f, welcome_message_fr: e.target.value }))} />
        </div>
        <div className={styles.field} style={{ marginTop: 12 }}>
          <label className={styles.label}>Anglais</label>
          <textarea className={styles.textarea} value={form.welcome_message_en}
            onChange={e => setForm(f => ({ ...f, welcome_message_en: e.target.value }))} />
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
