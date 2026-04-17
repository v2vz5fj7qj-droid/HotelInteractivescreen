import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../../useAdminApi';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import CatSelect from '../../components/CatSelect';
import TranslationPanel from '../../components/TranslationPanel';
import HotelAssignPicker from '../../components/HotelAssignPicker';
import { useTranslate } from '../../hooks/useTranslate';
import { useToast } from '../../hooks/useToast';
import styles from '../../Admin.module.css';
import localesMeta from '../../../i18n/locales.json';

const ALL_LOCALES  = Object.keys(localesMeta);           // ['fr','en','de','es',...]
const TRANS_FIELDS = ['name', 'address', 'description']; // champs traduisibles

const STATUS_STYLE = {
  pending:      { bg: '#FEF3C7', color: '#92400E', label: 'En attente' },
  pre_approved: { bg: '#DBEAFE', color: '#1E40AF', label: 'Pré-approuvé' },
  published:    { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:     { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
  archived:     { bg: '#F3F4F6', color: '#6B7280', label: 'Archivé' },
};

const FILTERS  = ['all', 'pending', 'published', 'rejected', 'archived'];
const PER_PAGE = 25;

// ── Initialise la map de traductions depuis initial?.translations ──
function initTrans(initial) {
  const map = {};
  for (const locale of ALL_LOCALES) {
    const found = initial?.translations?.find(t => t.locale === locale) || {};
    map[locale] = {
      name:        found.name        || '',
      address:     found.address     || '',
      description: found.description || '',
    };
  }
  return map;
}

// ── Modal création / édition ──────────────────────────────────────
function PlaceFormModal({ initial, categories, onClose, onSaved }) {
  const isEdit = !!initial;

  const [trans,        setTrans]        = useState(() => initTrans(initial));
  const [activeLang,   setActiveLang]   = useState('fr');
  const [sourceLang,   setSourceLang]   = useState('fr');
  const [form,         setForm]         = useState({
    category:   initial?.category || '',
    lat:        initial?.lat  != null ? String(initial.lat)  : '',
    lng:        initial?.lng  != null ? String(initial.lng)  : '',
    phone:      initial?.phone   || '',
    website:    initial?.website || '',
  });
  const [hotelIds,     setHotelIds]     = useState(
    () => (initial?.hotels || []).map(h => h.hotel_id)
  );
  const [images,       setImages]       = useState(initial?.images || []);
  const [pendingFiles, setPendingFiles] = useState([]); // création uniquement
  const [imgUploading, setImgUploading] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const fileInputRef = useRef(null);

  const { translateFields, translating } = useTranslate();

  const setField   = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLangVal = (locale, key, value) =>
    setTrans(prev => ({ ...prev, [locale]: { ...prev[locale], [key]: value } }));

  const handleTranslateAll = async () => {
    const result = await translateFields(TRANS_FIELDS, sourceLang, trans[sourceLang], ALL_LOCALES);
    setTrans(prev => {
      const updated = { ...prev };
      for (const [locale, fields] of Object.entries(result)) {
        updated[locale] = { ...updated[locale], ...fields };
      }
      return updated;
    });
  };

  const totalImgCount = isEdit ? images.length : pendingFiles.length;

  const handleFileSelect = (file) => {
    if (!file) return;
    if (totalImgCount >= 3) return;
    if (isEdit) {
      // Upload immédiat en mode édition
      setImgUploading(true);
      const fd = new FormData();
      fd.append('image', file);
      api.post(`/super/places/${initial.id}/images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
        .then(({ data }) => setImages(prev => [...prev, { id: data.id, url: data.url }]))
        .catch(err => alert(err.response?.data?.error || 'Erreur upload'))
        .finally(() => {
          setImgUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        });
    } else {
      // Prévisualisation locale en mode création
      setPendingFiles(prev => [...prev, { file, preview: URL.createObjectURL(file) }]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePendingFile = (index) => {
    setPendingFiles(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const deleteImage = async (imgId) => {
    if (!window.confirm('Supprimer cette image ?')) return;
    try {
      await api.delete(`/super/places/images/${imgId}`);
      setImages(prev => prev.filter(i => i.id !== imgId));
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur suppression');
    }
  };

  const save = async () => {
    if (!trans.fr.name.trim() || !form.category || !form.lat || !form.lng) return;
    setSaving(true);
    try {
      const translationsPayload = ALL_LOCALES
        .map(locale => ({ locale, ...trans[locale] }))
        .filter(t => t.name?.trim() || t.description?.trim() || t.address?.trim());

      const payload = {
        category:    form.category,
        lat:         parseFloat(form.lat),
        lng:         parseFloat(form.lng),
        phone:       form.phone   || null,
        website:     form.website || null,
        translations: translationsPayload,
      };
      let placeId;
      if (isEdit) {
        await api.put(`/super/places/${initial.id}`, payload);
        placeId = initial.id;
      } else {
        const { data } = await api.post('/super/places', { ...payload, display_order: 0 });
        placeId = data.id;
        // Upload séquentiel des images sélectionnées avant la création
        for (const { file } of pendingFiles) {
          const fd = new FormData();
          fd.append('image', file);
          await api.post(`/super/places/${placeId}/images`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          }).catch(() => {}); // ne pas bloquer si un upload échoue
        }
        pendingFiles.forEach(({ preview }) => URL.revokeObjectURL(preview));
      }
      await api.put(`/super/places/${placeId}/hotels`, { hotel_ids: hotelIds });
      onSaved();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const curTrans = trans[activeLang] || { name: '', address: '', description: '' };
  const langMeta = localesMeta[activeLang] || {};

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {isEdit ? `Modifier — ${trans.fr.name || initial.slug}` : 'Ajouter un lieu'}
          </span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <div style={{
            background: isEdit ? '#EFF6FF22' : '#D1FAE522',
            border: `1px solid ${isEdit ? '#93C5FD' : '#6EE7B7'}`,
            borderRadius: 8, padding: '8px 14px', marginBottom: 12,
            fontSize: '0.82rem', color: isEdit ? '#1E40AF' : '#065F46',
          }}>
            {isEdit
              ? 'Les modifications seront visibles immédiatement sur la borne.'
              : "Publication immédiate — le lieu sera visible sur la borne dès l'enregistrement."}
          </div>

          {/* Champs non-traduisibles */}
          <div className={styles.field}>
            <label className={styles.label}>Catégorie *</label>
            <CatSelect value={form.category} onChange={v => setField('category', v)} categories={categories} />
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Latitude *</label>
              <input className={styles.input} type="number" step="0.000001"
                value={form.lat} onChange={e => setField('lat', e.target.value)} placeholder="12.3647" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Longitude *</label>
              <input className={styles.input} type="number" step="0.000001"
                value={form.lng} onChange={e => setField('lng', e.target.value)} placeholder="-1.5354" />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Téléphone</label>
              <input className={styles.input} value={form.phone} onChange={e => setField('phone', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Site web</label>
              <input className={styles.input} value={form.website} onChange={e => setField('website', e.target.value)} />
            </div>
          </div>

          <HotelAssignPicker selectedIds={hotelIds} onChange={setHotelIds} />

          {/* Panneau de traduction automatique */}
          <TranslationPanel
            sourceLang={sourceLang}
            onSourceChange={setSourceLang}
            allLocales={ALL_LOCALES}
            onTranslateAll={handleTranslateAll}
            translating={translating}
          />

          {/* Onglets de langues */}
          <div className={styles.tabs}>
            {ALL_LOCALES.map(l => {
              const m = localesMeta[l] || {};
              const filled = trans[l].name?.trim();
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

          {/* Champs traduisibles pour la langue active */}
          <div key={activeLang}>
            <div className={styles.field}>
              <label className={styles.label}>
                {langMeta.flag} Nom{activeLang === 'fr' ? ' *' : ''}
              </label>
              <input className={styles.input} value={curTrans.name}
                onChange={e => setLangVal(activeLang, 'name', e.target.value)}
                autoFocus={activeLang === 'fr'} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{langMeta.flag} Adresse</label>
              <input className={styles.input} value={curTrans.address}
                onChange={e => setLangVal(activeLang, 'address', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{langMeta.flag} Description</label>
              <textarea className={styles.textarea} rows={3} value={curTrans.description}
                onChange={e => setLangVal(activeLang, 'description', e.target.value)} />
            </div>
          </div>
          {/* ── Galerie photos ── */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className={styles.label} style={{ marginBottom: 0 }}>
                Photos ({totalImgCount}/3)
              </label>
              {totalImgCount < 3 && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imgUploading}
                  >
                    {imgUploading ? 'Upload…' : '+ Ajouter une photo'}
                  </button>
                </>
              )}
            </div>
            {totalImgCount === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#9CA3AF', fontStyle: 'italic' }}>
                Aucune photo — ajoutez jusqu'à 3 images (JPG, PNG, WebP · 3 Mo max)
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {isEdit
                  ? images.map(img => (
                      <div key={img.id} style={{ position: 'relative', width: 110, height: 80 }}>
                        <img src={img.url} alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid #E5E7EB' }} />
                        <button type="button" onClick={() => deleteImage(img.id)}
                          style={{
                            position: 'absolute', top: 3, right: 3,
                            background: 'rgba(0,0,0,0.55)', color: '#fff',
                            border: 'none', borderRadius: '50%',
                            width: 20, height: 20, fontSize: '0.7rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>✕</button>
                      </div>
                    ))
                  : pendingFiles.map((pf, i) => (
                      <div key={i} style={{ position: 'relative', width: 110, height: 80 }}>
                        <img src={pf.preview} alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid #E5E7EB' }} />
                        <button type="button" onClick={() => removePendingFile(i)}
                          style={{
                            position: 'absolute', top: 3, right: 3,
                            background: 'rgba(0,0,0,0.55)', color: '#fff',
                            border: 'none', borderRadius: '50%',
                            width: 20, height: 20, fontSize: '0.7rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>✕</button>
                      </div>
                    ))
                }
              </div>
            )}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={save}
            disabled={saving || !trans.fr.name.trim() || !form.category || !form.lat || !form.lng}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Publier le lieu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal détail ──────────────────────────────────────────────────
function DetailModal({ detail, onClose, onPublish, onReject, onDelete, onEdit }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason,     setReason]     = useState('');
  const [acting,     setActing]     = useState(false);

  if (!detail) return null;

  const st          = STATUS_STYLE[detail.status] || STATUS_STYLE.pending;
  const canValidate = detail.status === 'pending' || detail.status === 'pre_approved';

  const handlePublish = async () => { setActing(true); await onPublish(detail.id); setActing(false); };
  const handleReject  = async () => {
    if (!reason.trim()) return;
    setActing(true); await onReject(detail.id, reason.trim()); setActing(false);
  };
  const handleDelete = async () => { setActing(true); await onDelete(detail.id); setActing(false); };

  const trans = detail.translations?.find(t => t.locale === 'fr') || {};

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Détail — {trans.name || detail.name || detail.slug}</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 2 }}>Créé par</div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{detail.created_by_email || '—'}</div>
              {detail.created_at && (
                <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 2 }}>
                  {new Date(detail.created_at).toLocaleString('fr-FR')}
                </div>
              )}
            </div>
            <span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Nom"        value={trans.name    || detail.name} />
            <Field label="Catégorie"  value={detail.category} />
            <Field label="Latitude"   value={detail.lat} />
            <Field label="Longitude"  value={detail.lng} />
            <Field label="Adresse"    value={trans.address || detail.address} span />
            <Field label="Téléphone"  value={detail.phone} />
            <Field label="Site web"   value={detail.website} link />
          </div>

          {detail.translations?.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 6 }}>Langues disponibles</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {detail.translations.map(t => {
                  const m = localesMeta[t.locale] || {};
                  return (
                    <span key={t.locale} style={{ background: '#E5E7EB', borderRadius: 6,
                      padding: '2px 8px', fontSize: '0.78rem', fontWeight: 600 }}>
                      {m.flag} {m.nativeName}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {detail.lat && detail.lng && (
            <a href={`https://www.openstreetmap.org/?mlat=${detail.lat}&mlon=${detail.lng}&zoom=15`}
              target="_blank" rel="noreferrer"
              style={{ fontSize: '0.82rem', color: '#C2782A', textDecoration: 'underline' }}>
              Voir sur la carte (OpenStreetMap)
            </a>
          )}

          {detail.hotels?.length > 0 && (
            <div>
              <div style={{ fontSize: '0.78rem', color: '#6B7280', marginBottom: 4 }}>Hôtels associés</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {detail.hotels.map(h => (
                  <span key={h.hotel_id} style={{ background: '#E5E7EB', borderRadius: 6,
                    padding: '3px 10px', fontSize: '0.8rem', fontWeight: 600 }}>{h.nom}</span>
                ))}
              </div>
            </div>
          )}

          {detail.rejection_reason && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
              padding: '10px 14px', fontSize: '0.85rem', color: '#991B1B' }}>
              Motif de rejet : {detail.rejection_reason}
            </div>
          )}

          {rejectMode && (
            <div>
              <label className={styles.label} style={{ marginBottom: 4 }}>Motif du rejet *</label>
              <textarea className={styles.textarea} value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Expliquer le motif au contributeur…" rows={3} autoFocus />
            </div>
          )}
        </div>

        <div className={styles.modalFooter} style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnDanger} style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              onClick={handleDelete} disabled={acting}>Supprimer</button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnSecondary}
              onClick={rejectMode ? () => setRejectMode(false) : onClose} disabled={acting}>
              {rejectMode ? 'Annuler' : 'Fermer'}
            </button>
            {!rejectMode && (
              <button className={styles.btnSecondary} onClick={() => onEdit(detail)} disabled={acting}>
                Modifier
              </button>
            )}
            {canValidate && !rejectMode && (
              <button className={styles.btnSecondary} style={{ color: '#991B1B', borderColor: '#FECACA' }}
                onClick={() => { setRejectMode(true); setReason(''); }} disabled={acting}>
                Rejeter
              </button>
            )}
            {rejectMode && (
              <button className={styles.btnDanger}
                onClick={handleReject} disabled={acting || !reason.trim()}>
                {acting ? '…' : 'Confirmer le rejet'}
              </button>
            )}
            {canValidate && !rejectMode && (
              <button className={styles.btnPrimary} onClick={handlePublish} disabled={acting}>
                {acting ? '…' : 'Publier'}
              </button>
            )}
            {detail.status === 'rejected' && !rejectMode && (
              <button className={styles.btnPrimary} onClick={handlePublish} disabled={acting}>
                {acting ? '…' : 'Re-publier'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, span, link }) {
  if (!value && value !== 0) return null;
  return (
    <div style={span ? { gridColumn: '1 / -1' } : {}}>
      <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 2 }}>{label}</div>
      {link
        ? <a href={value} target="_blank" rel="noreferrer"
            style={{ fontSize: '0.88rem', color: '#C2782A', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {value}
          </a>
        : <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{value}</div>
      }
    </div>
  );
}

// ── Composant principal ──────────────────────────────────────────
export default function PlacesManager() {
  const [places,     setPlaces]     = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [toast,      showToast]     = useToast();
  const [confirm,    setConfirm]    = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [formTarget, setFormTarget] = useState(null);
  const [poiCats,    setPoiCats]    = useState([]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: PER_PAGE };
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const { data } = await api.get('/super/places', { params });
      setPlaces(data.data || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { load(1); }, [load]);

  useEffect(() => {
    api.get('/super/poi-categories').then(r => setPoiCats(r.data)).catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / PER_PAGE);

  const openDetail = async (id) => {
    setDetail({ loading: true });
    try {
      const { data } = await api.get(`/super/places/${id}`);
      setDetail(data);
    } catch { setDetail(null); }
  };

  const openEdit = async (placeOrId) => {
    const id = placeOrId?.id ?? placeOrId;
    try {
      const { data } = await api.get(`/super/places/${id}`);
      setDetail(null);
      setFormTarget(data);
    } catch { alert('Impossible de charger le lieu'); }
  };

  const publish = async (id) => {
    try {
      await api.post(`/super/places/${id}/publish`, {});
      showToast('Lieu publié'); setDetail(null); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const rejectPlace = async (id, reason) => {
    try {
      await api.post(`/super/places/${id}/reject`, { reason });
      showToast('Lieu rejeté'); setDetail(null); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const deletePlace = async (id) => {
    try {
      await api.delete(`/super/places/${id}`);
      showToast('Lieu supprimé'); setDetail(null); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const publishQuick = async (id) => {
    try {
      await api.post(`/super/places/${id}/publish`, {});
      showToast('Lieu publié'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const handleReject = async (reason) => {
    try {
      await api.post(`/super/places/${confirm.id}/reject`, { reason });
      showToast('Lieu rejeté'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/super/places/${confirm.id}`);
      showToast('Lieu supprimé'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Carte & Lieux</h1>
          <p className={styles.managerSub}>Gestion des points d'intérêt ({total} total)</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setFormTarget('create')}>+ Ajouter un lieu</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid',
              borderColor: filter === f ? '#C2782A' : '#E5E7EB',
              background: filter === f ? '#C2782A' : '#fff',
              color: filter === f ? '#fff' : '#6B7280',
              fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            {f === 'all' ? 'Tous' : STATUS_STYLE[f]?.label || f}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1)}
          placeholder="Rechercher par nom ou catégorie…"
          className={styles.input} style={{ maxWidth: 320 }} />
        <button className={styles.btnSecondary} onClick={() => load(1)}>Rechercher</button>
        {search && <button className={styles.btnSecondary} onClick={() => setSearch('')}>✕</button>}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom</th><th>Catégorie</th><th>Créé par</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Chargement…</td></tr>
            ) : places.length === 0 ? (
              <tr><td colSpan={5}><div className={styles.empty}>
                <div className={styles.emptyIcon}>🗺️</div>
                <div className={styles.emptyText}>Aucun lieu</div>
              </div></td></tr>
            ) : places.map(p => {
              const st = STATUS_STYLE[p.status] || STATUS_STYLE.pending;
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.name || p.slug}</td>
                  <td style={{ color: '#6B7280' }}>{p.category || '—'}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{p.created_by_email || '—'}</td>
                  <td><span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  <td>
                    <div className={styles.tdActions}>
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => openDetail(p.id)}>Voir</button>
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => openEdit(p.id)}>Modifier</button>
                      {(p.status === 'pending' || p.status === 'pre_approved') && (
                        <>
                          <button className={styles.btnPrimary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => publishQuick(p.id)}>Publier</button>
                          <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => setConfirm({ id: p.id, mode: 'reject', name: p.name || p.slug })}>
                            Rejeter</button>
                        </>
                      )}
                      {p.status === 'rejected' && (
                        <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => publishQuick(p.id)}>Re-publier</button>
                      )}
                      <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => setConfirm({ id: p.id, mode: 'delete', name: p.name || p.slug })}>
                        Supprimer</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={p => load(p)} />

      {formTarget && (
        <PlaceFormModal
          initial={formTarget === 'create' ? null : formTarget}
          categories={poiCats}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            showToast(formTarget === 'create' ? 'Lieu publié' : 'Lieu modifié');
            load(page);
          }}
        />
      )}

      {detail && !detail.loading && (
        <DetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onPublish={publish}
          onReject={rejectPlace}
          onDelete={deletePlace}
          onEdit={openEdit}
        />
      )}
      {detail?.loading && (
        <div className={styles.modalOverlay}>
          <div style={{ color: '#fff', fontSize: '1rem' }}>Chargement…</div>
        </div>
      )}

      <ConfirmModal
        open={confirm?.mode === 'reject'}
        title="Rejeter ce lieu"
        message={`Lieu : ${confirm?.name}`}
        mode="reason"
        danger
        onConfirm={handleReject}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.mode === 'delete'}
        title="Supprimer ce lieu ?"
        message={`Cette action est irréversible. Lieu : "${confirm?.name}"`}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
