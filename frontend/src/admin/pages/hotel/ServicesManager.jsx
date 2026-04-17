import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperHotelId } from '../../components/SuperHotelSelector';
import TranslationPanel from '../../components/TranslationPanel';
import { useTranslate } from '../../hooks/useTranslate';
import localesMeta from '../../../i18n/locales.json';
import styles from '../../Admin.module.css';

const ALL_LOCALES = Object.keys(localesMeta);
const emptyTr = () =>
  Object.fromEntries(ALL_LOCALES.map(l => [l, { name: '', description: '', benefits: '' }]));

const EMPTY_SVC = {
  category_id: '', slug: '', duration_min: '', price_fcfa: 0,
  contact_phone: '', booking_info: '', available_hours: '', available_days: '',
  display_order: 0, image_url: '', is_active: true,
  translations: emptyTr(),
};

export default function ServicesManager() {
  const { user }  = useAuth();
  const hotelId   = useSuperHotelId(user);
  const params    = hotelId ? { hotel_id: hotelId } : {};

  const [services,  setServices]  = useState([]);
  const [cats,      setCats]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // null | 'create' | {service obj}
  const [form,      setForm]      = useState(EMPTY_SVC);
  const [tab,       setTab]       = useState('fr');
  const [sourceLang, setSourceLang] = useState('fr');
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast,     setToast]     = useState('');
  const imgInputRef = useRef(null);

  const { translateFields, translating } = useTranslate();

  const load = useCallback(async () => {
    try {
      const [{ data: sv }, { data: ct }] = await Promise.all([
        api.get('/hotel/services', { params }),
        api.get('/hotel/services/categories', { params }),
      ]);
      setServices(sv);
      setCats(ct);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const openCreate = () => {
    setForm({ ...EMPTY_SVC, category_id: cats[0]?.id || '', translations: emptyTr() });
    setModal('create'); setTab('fr'); setSourceLang('fr');
  };

  const openEdit = sv => {
    const allTr = Object.fromEntries(
      ALL_LOCALES.map(l => [l, { name: '', description: '', benefits: '', ...sv.translations?.[l] }])
    );
    setForm({
      category_id:    sv.category_id,
      slug:           sv.slug,
      duration_min:   sv.duration_min || '',
      price_fcfa:     sv.price_fcfa || 0,
      contact_phone:  sv.contact_phone || '',
      booking_info:   sv.booking_info || '',
      available_hours: sv.available_hours || '',
      available_days: sv.available_days || '',
      display_order:  sv.display_order || 0,
      image_url:      sv.image_url || '',
      is_active:      sv.is_active !== false,
      translations:   allTr,
    });
    setModal(sv); setTab('fr'); setSourceLang('fr');
  };

  const set    = (field, val) => setForm(f => ({ ...f, [field]: val }));
  const setTr  = (locale, field, val) => setForm(f => ({
    ...f,
    translations: { ...f.translations, [locale]: { ...f.translations[locale], [field]: val } },
  }));

  const handleTranslateAll = async () => {
    const result = await translateFields(
      ['name', 'description', 'benefits'],
      sourceLang,
      form.translations[sourceLang],
      ALL_LOCALES,
    );
    setForm(f => {
      const updated = { ...f.translations };
      for (const [locale, values] of Object.entries(result)) {
        updated[locale] = { ...updated[locale], ...values };
      }
      return { ...f, translations: updated };
    });
    showToast('Traduction automatique appliquée — vérifiez les onglets.');
  };

  const save = async () => {
    setSaving(true);
    try {
      const translations = ALL_LOCALES
        .filter(l => form.translations[l]?.name?.trim())
        .map(l => ({
          locale:      l,
          name:        form.translations[l].name,
          description: form.translations[l].description || null,
          benefits:    form.translations[l].benefits || null,
        }));

      const body = {
        category_id:     form.category_id,
        slug:            form.slug,
        duration_min:    form.duration_min ? parseInt(form.duration_min) : null,
        price_fcfa:      parseInt(form.price_fcfa) || 0,
        contact_phone:   form.contact_phone || null,
        booking_info:    form.booking_info  || null,
        available_hours: form.available_hours || null,
        available_days:  form.available_days || null,
        display_order:   parseInt(form.display_order) || 0,
        image_url:       form.image_url || null,
        is_active:       form.is_active,
        translations,
      };

      if (modal === 'create') {
        await api.post('/hotel/services', body, { params });
        showToast('Service créé');
      } else {
        await api.put(`/hotel/services/${modal.id}`, body, { params });
        showToast('Service mis à jour');
      }
      setModal(null); load();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const del = async (id, name) => {
    if (!window.confirm(`Supprimer "${name}" ?`)) return;
    await api.delete(`/hotel/services/${id}`, { params });
    showToast('Service supprimé'); load();
  };

  const uploadImage = async (file) => {
    if (!modal?.id) return;
    const fd = new FormData();
    fd.append('image', file);
    setUploading(true);
    try {
      const r = await api.post(
        `/hotel/services/${modal.id}/image`,
        fd,
        { params, headers: { 'Content-Type': 'multipart/form-data' } }
      );
      set('image_url', r.data.url);
      showToast('Image uploadée');
    } catch { showToast('Erreur upload image'); }
    finally { setUploading(false); }
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Services & bien-être</h1>
          <p className={styles.managerSub}>{services.length} service{services.length !== 1 ? 's' : ''} enregistré{services.length !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate} disabled={cats.length === 0}>
          + Ajouter un service
        </button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {cats.length === 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, fontSize: '0.88rem', color: '#92400E' }}>
          Aucune catégorie disponible. Créez d'abord une catégorie dans les catégories globales (super-admin).
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom</th><th>Catégorie</th><th>Durée</th><th>Prix (FCFA)</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>💆</div><div className={styles.emptyText}>Aucun service</div></div></td></tr>
            ) : services.map(sv => (
              <tr key={sv.id}>
                <td style={{ fontWeight: 600 }}>{sv.translations?.fr?.name || sv.slug}</td>
                <td style={{ color: '#6B7280' }}>{sv.category_icon} {sv.category_fr}</td>
                <td style={{ color: '#6B7280' }}>{sv.duration_min ? `${sv.duration_min} min` : '—'}</td>
                <td style={{ color: '#6B7280' }}>{sv.price_fcfa ? Number(sv.price_fcfa).toLocaleString('fr-BF') : 'Gratuit'}</td>
                <td>
                  <span className={`${styles.badge} ${sv.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                    {sv.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td>
                  <div className={styles.tdActions}>
                    <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(sv)}>Modifier</button>
                    <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                      onClick={() => del(sv.id, sv.translations?.fr?.name || sv.slug)}>Supprimer</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal !== null && (
        <div className={styles.modalBackdrop} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                {modal === 'create' ? 'Nouveau service' : `Modifier — ${modal.translations?.fr?.name || modal.slug}`}
              </span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>

              {/* ── Infos générales ── */}
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Catégorie *</label>
                  <select className={styles.select} value={form.category_id}
                    onChange={e => set('category_id', e.target.value)}>
                    {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label_fr}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Slug *</label>
                  <input className={styles.input} value={form.slug}
                    onChange={e => set('slug', e.target.value)}
                    disabled={modal !== 'create'}
                    placeholder="ex: swedish-massage" />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Durée (min)</label>
                  <input className={styles.input} type="number" value={form.duration_min}
                    onChange={e => set('duration_min', e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Prix (FCFA)</label>
                  <input className={styles.input} type="number" value={form.price_fcfa}
                    onChange={e => set('price_fcfa', e.target.value)} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Horaires disponibles</label>
                  <input className={styles.input} value={form.available_hours}
                    onChange={e => set('available_hours', e.target.value)} placeholder="ex: 09:00–19:00" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Jours disponibles</label>
                  <input className={styles.input} value={form.available_days}
                    onChange={e => set('available_days', e.target.value)} placeholder="ex: Lun–Sam" />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Téléphone contact</label>
                  <input className={styles.input} value={form.contact_phone}
                    onChange={e => set('contact_phone', e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Info réservation</label>
                  <input className={styles.input} value={form.booking_info}
                    onChange={e => set('booking_info', e.target.value)} />
                </div>
              </div>

              {/* ── Image d'aperçu ── */}
              <div className={styles.field}>
                <label className={styles.label}>Image d'aperçu</label>
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt="Aperçu"
                    onError={e => { e.target.style.display = 'none'; }}
                    style={{ display: 'block', marginBottom: 8, height: 80, borderRadius: 8,
                      objectFit: 'cover', border: '1px solid #E5E7EB' }}
                  />
                )}
                <input className={styles.input} value={form.image_url}
                  onChange={e => set('image_url', e.target.value)}
                  placeholder="https://… ou uploader ci-dessous" />
                {modal !== 'create' ? (
                  <>
                    <input
                      ref={imgInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={e => { if (e.target.files[0]) uploadImage(e.target.files[0]); }}
                    />
                    <button type="button" className={styles.btnSecondary} style={{ marginTop: 6 }}
                      disabled={uploading} onClick={() => imgInputRef.current?.click()}>
                      {uploading ? 'Upload en cours…' : '📁 Uploader une image'}
                    </button>
                  </>
                ) : (
                  <p style={{ fontSize: '0.78rem', color: '#6B7280', marginTop: 4 }}>
                    L'upload de fichier sera disponible après la création du service.
                  </p>
                )}
              </div>

              {/* ── Actif / inactif ── */}
              <div className={styles.field} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => set('is_active', e.target.checked)} />
                  <span className={styles.toggleSlider} />
                </label>
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Service actif (visible sur la borne)</span>
              </div>

              {/* ── Traductions ── */}
              <TranslationPanel
                sourceLang={sourceLang}
                onSourceChange={setSourceLang}
                allLocales={ALL_LOCALES}
                onTranslateAll={handleTranslateAll}
                translating={translating}
              />

              <div className={styles.tabs} style={{ flexWrap: 'wrap' }}>
                {ALL_LOCALES.map(l => (
                  <button key={l} className={`${styles.tab} ${tab === l ? styles.tabActive : ''}`}
                    onClick={() => setTab(l)} style={{ position: 'relative' }}>
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

              <div className={styles.field} style={{ marginTop: 12 }}>
                <label className={styles.label}>Nom du service</label>
                <input className={styles.input} value={form.translations[tab]?.name || ''}
                  onChange={e => setTr(tab, 'name', e.target.value)} />
              </div>
              <div className={styles.field} style={{ marginTop: 12 }}>
                <label className={styles.label}>Description</label>
                <textarea className={styles.textarea} value={form.translations[tab]?.description || ''}
                  onChange={e => setTr(tab, 'description', e.target.value)} />
              </div>
              <div className={styles.field} style={{ marginTop: 12 }}>
                <label className={styles.label}>Bénéfices / points clés <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(séparés par ; )</span></label>
                <input className={styles.input} value={form.translations[tab]?.benefits || ''}
                  onChange={e => setTr(tab, 'benefits', e.target.value)}
                  placeholder="ex: Détente profonde ; Améliore la circulation ; Réduit le stress" />
              </div>

            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save}
                disabled={saving || !form.slug || !form.category_id || !form.translations?.fr?.name}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
