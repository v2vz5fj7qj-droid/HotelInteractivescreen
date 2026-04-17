import React, { useEffect, useState, useCallback } from 'react';
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

const ALL_LOCALES  = Object.keys(localesMeta);
const TRANS_FIELDS = ['title', 'description'];

const STATUS_STYLE = {
  pending:      { bg: '#FEF3C7', color: '#92400E', label: 'En attente' },
  pre_approved: { bg: '#DBEAFE', color: '#1E40AF', label: 'Pré-approuvé' },
  published:    { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:     { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
  archived:     { bg: '#F3F4F6', color: '#6B7280', label: 'Archivé' },
};

const FILTERS  = ['all', 'pending', 'pre_approved', 'published', 'rejected', 'archived'];
const PER_PAGE = 25;

function toSlug(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fmtDate(v) { return v ? String(v).slice(0, 10) : ''; }

// ── Initialise la map de traductions ─────────────────────────────
function initTrans(initial) {
  const map = {};
  for (const locale of ALL_LOCALES) {
    const found = initial?.translations?.find(t => t.locale === locale) || {};
    map[locale] = {
      title:       found.title       || '',
      description: found.description || '',
    };
  }
  return map;
}

// ── Modal création / édition ──────────────────────────────────────
function EventFormModal({ initial, categories, onClose, onSaved }) {
  const isEdit = !!initial;

  const [trans,      setTrans]      = useState(() => initTrans(initial));
  const [activeLang, setActiveLang] = useState('fr');
  const [sourceLang, setSourceLang] = useState('fr');
  const [form,       setForm]       = useState({
    slug:        initial?.slug       || '',
    category:    initial?.category   || '',
    start_date:  fmtDate(initial?.start_date),
    end_date:    fmtDate(initial?.end_date),
    start_time:  initial?.start_time || '',
    end_time:    initial?.end_time   || '',
    location:    initial?.location   || '',
    price_fcfa:  initial?.price_fcfa != null ? String(initial.price_fcfa) : '',
    is_featured: !!initial?.is_featured,
  });
  const [hotelIds, setHotelIds] = useState(
    () => (initial?.hotels || []).map(h => h.hotel_id)
  );
  const [imageFile,    setImageFile]    = useState(null);
  const [imagePreview, setImagePreview] = useState(initial?.image_url || null);
  const [removingImg,  setRemovingImg]  = useState(false);
  const [saving, setSaving] = useState(false);

  const { translateFields, translating } = useTranslate();

  const setField   = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setLangVal = (locale, key, value) =>
    setTrans(prev => ({ ...prev, [locale]: { ...prev[locale], [key]: value } }));

  const handleTitle = (e) => {
    const title = e.target.value;
    setTrans(prev => ({ ...prev, fr: { ...prev.fr, title } }));
    if (!isEdit) setField('slug', toSlug(title));
  };

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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = async () => {
    if (!isEdit || !initial?.image_url) { setImageFile(null); setImagePreview(null); return; }
    setRemovingImg(true);
    try {
      await api.delete(`/super/events/${initial.id}/image`);
      setImagePreview(null);
      setImageFile(null);
    } catch (err) { alert(err.response?.data?.error || 'Erreur lors de la suppression'); }
    finally { setRemovingImg(false); }
  };

  const save = async () => {
    if (!trans.fr.title.trim() || !form.category || !form.start_date || !form.slug) return;
    setSaving(true);
    try {
      const translationsPayload = ALL_LOCALES
        .map(locale => ({ locale, ...trans[locale] }))
        .filter(t => t.title?.trim());

      const payload = {
        category:    form.category,
        start_date:  form.start_date,
        end_date:    form.end_date   || null,
        start_time:  form.start_time || null,
        end_time:    form.end_time   || null,
        location:    form.location   || null,
        price_fcfa:  form.price_fcfa ? parseInt(form.price_fcfa) : 0,
        is_featured: form.is_featured ? 1 : 0,
        translations: translationsPayload,
      };
      let eventId;
      if (isEdit) {
        await api.put(`/super/events/${initial.id}`, payload);
        eventId = initial.id;
      } else {
        const { data } = await api.post('/super/events', { ...payload, slug: form.slug });
        eventId = data.id;
      }
      await api.put(`/super/events/${eventId}/hotels`, { hotel_ids: hotelIds });

      // Upload image si un fichier a été sélectionné
      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        await api.post(`/super/events/${eventId}/image`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      onSaved();
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    finally { setSaving(false); }
  };

  const curTrans = trans[activeLang] || { title: '', description: '' };
  const langMeta = localesMeta[activeLang] || {};

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {isEdit ? `Modifier — ${trans.fr.title || initial.slug}` : 'Créer un événement'}
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
              : "Publication immédiate — l'événement sera visible sur la borne dès l'enregistrement."}
          </div>

          {/* Champs non-traduisibles */}
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Slug (URL) *</label>
              <input className={styles.input} value={form.slug}
                onChange={e => setField('slug', e.target.value)}
                disabled={isEdit}
                style={isEdit ? { opacity: 0.5 } : {}} />
              {isEdit && (
                <span style={{ fontSize: '0.72rem', color: '#6B7280', marginTop: 2 }}>
                  Le slug n'est pas modifiable
                </span>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Catégorie *</label>
              <CatSelect value={form.category} onChange={v => setField('category', v)} categories={categories} />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Date de début *</label>
              <input className={styles.input} type="date" value={form.start_date}
                onChange={e => setField('start_date', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Date de fin</label>
              <input className={styles.input} type="date" value={form.end_date}
                onChange={e => setField('end_date', e.target.value)} />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Heure de début</label>
              <input className={styles.input} type="time" value={form.start_time}
                onChange={e => setField('start_time', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Heure de fin</label>
              <input className={styles.input} type="time" value={form.end_time}
                onChange={e => setField('end_time', e.target.value)} />
            </div>
          </div>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Lieu / Adresse</label>
              <input className={styles.input} value={form.location}
                onChange={e => setField('location', e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Prix (FCFA)</label>
              <input className={styles.input} type="number" min="0" value={form.price_fcfa}
                onChange={e => setField('price_fcfa', e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={form.is_featured}
                onChange={e => setField('is_featured', e.target.checked)}
                style={{ width: 16, height: 16 }} />
              Événement mis en avant (featured)
            </label>
          </div>

          {/* Image d'illustration */}
          <div className={styles.field}>
            <label className={styles.label}>Image d'illustration</label>
            {imagePreview ? (
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
                <img
                  src={imagePreview}
                  alt="Illustration"
                  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8, border: '1px solid #E5E7EB' }}
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={removingImg}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    border: 'none', borderRadius: 6, padding: '3px 8px',
                    fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                  }}>
                  {removingImg ? '…' : '✕ Supprimer'}
                </button>
              </div>
            ) : (
              <div style={{
                border: '2px dashed #D1D5DB', borderRadius: 8, padding: '20px 16px',
                textAlign: 'center', color: '#9CA3AF', fontSize: '0.82rem', marginBottom: 8,
              }}>
                Aucune image — JPG, PNG ou WebP, max 5 Mo
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              style={{ fontSize: '0.82rem' }}
            />
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
              const filled = trans[l].title?.trim();
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

          {/* Champs traduisibles */}
          <div key={activeLang}>
            <div className={styles.field}>
              <label className={styles.label}>
                {langMeta.flag} Titre{activeLang === 'fr' ? ' *' : ''}
              </label>
              {activeLang === 'fr' ? (
                <input className={styles.input} value={curTrans.title}
                  onChange={handleTitle} autoFocus />
              ) : (
                <input className={styles.input} value={curTrans.title}
                  onChange={e => setLangVal(activeLang, 'title', e.target.value)} />
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>{langMeta.flag} Description</label>
              <textarea className={styles.textarea} rows={3} value={curTrans.description}
                onChange={e => setLangVal(activeLang, 'description', e.target.value)} />
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose}>Annuler</button>
          <button className={styles.btnPrimary} onClick={save}
            disabled={saving || !trans.fr.title.trim() || !form.category || !form.start_date || !form.slug}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : "Publier l'événement"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal détail ──────────────────────────────────────────────────
function DetailModal({ detail, onClose, onPublish, onReject, onArchive, onUnarchive, onDelete, onEdit }) {
  const [rejectMode,    setRejectMode]    = useState(false);
  const [reason,        setReason]        = useState('');
  const [acting,        setActing]        = useState(false);
  const [datePassed,    setDatePassed]    = useState(false);

  if (!detail) return null;

  const st          = STATUS_STYLE[detail.status] || STATUS_STYLE.pending;
  const canValidate = detail.status === 'pending' || detail.status === 'pre_approved';
  const trans       = detail.translations?.find(t => t.locale === 'fr') || {};

  const handlePublish   = async () => { setActing(true); await onPublish(detail.id); setActing(false); };
  const handleReject    = async () => {
    if (!reason.trim()) return;
    setActing(true); await onReject(detail.id, reason.trim()); setActing(false);
  };
  const handleArchive   = async () => { setActing(true); await onArchive(detail.id); setActing(false); };
  const handleUnarchive = async () => {
    setDatePassed(false);
    setActing(true);
    const err = await onUnarchive(detail.id);
    if (err === 'date_passed') setDatePassed(true);
    setActing(false);
  };
  const handleDelete    = async () => { setActing(true); await onDelete(detail.id); setActing(false); };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Détail — {trans.title || detail.title || detail.slug}</span>
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
              {detail.hotel_nom && (
                <div style={{ fontSize: '0.78rem', color: '#C2782A', marginTop: 2, fontWeight: 600 }}>
                  Hôtel : {detail.hotel_nom}
                </div>
              )}
            </div>
            <span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>

          {detail.image_url && (
            <img
              src={detail.image_url}
              alt="Illustration"
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid #E5E7EB' }}
            />
          )}

          {trans.title && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 2 }}>Titre</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{trans.title}</div>
            </div>
          )}
          {trans.description && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 2 }}>Description</div>
              <div style={{ fontSize: '0.88rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{trans.description}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Catégorie"     value={detail.category} />
            <Field label="Prix (FCFA)"   value={detail.price_fcfa != null ? `${detail.price_fcfa} FCFA` : null} />
            <Field label="Date de début" value={detail.start_date ? new Date(detail.start_date).toLocaleDateString('fr-FR') : null} />
            <Field label="Date de fin"   value={detail.end_date   ? new Date(detail.end_date).toLocaleDateString('fr-FR')   : null} />
            <Field label="Heure"         value={detail.start_time} />
            <Field label="Lieu"          value={detail.location} />
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

          {detail.rejection_reason && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
              padding: '10px 14px', fontSize: '0.85rem', color: '#991B1B' }}>
              Motif de rejet : {detail.rejection_reason}
            </div>
          )}

          {datePassed && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8,
              padding: '10px 14px', fontSize: '0.85rem', color: '#92400E' }}>
              La date de cet événement est passée. Modifiez la date avant de désarchiver.
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
            {detail.status === 'published' && !rejectMode && (
              <button className={styles.btnSecondary} style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                onClick={handleArchive} disabled={acting}>Archiver</button>
            )}
            {detail.status === 'archived' && !rejectMode && (
              <button className={styles.btnSecondary} style={{ padding: '6px 14px', fontSize: '0.82rem' }}
                onClick={handleUnarchive} disabled={acting}>Désarchiver</button>
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
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  if (!value && value !== 0) return null;
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────
export default function SuperEventsManager() {
  const [events,     setEvents]     = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [filter,     setFilter]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [toast,      showToast]     = useToast();
  const [confirm,    setConfirm]    = useState(null);
  const [detail,     setDetail]     = useState(null);
  const [formTarget, setFormTarget] = useState(null);
  const [eventCats,  setEventCats]  = useState([]);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: PER_PAGE };
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const { data } = await api.get('/super/events', { params });
      setEvents(data.data || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { load(1); }, [load]);

  useEffect(() => {
    api.get('/super/event-categories').then(r => setEventCats(r.data)).catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / PER_PAGE);

  const openDetail = async (id) => {
    setDetail({ loading: true });
    try {
      const { data } = await api.get(`/super/events/${id}`);
      setDetail(data);
    } catch { setDetail(null); }
  };

  const openEdit = async (eventOrId) => {
    const id = eventOrId?.id ?? eventOrId;
    try {
      const { data } = await api.get(`/super/events/${id}`);
      setDetail(null);
      setFormTarget(data);
    } catch { alert("Impossible de charger l'événement"); }
  };

  const publish = async (id) => {
    try {
      await api.post(`/super/events/${id}/publish`, {});
      showToast('Événement publié'); setDetail(null); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const rejectEvent = async (id, reason) => {
    try {
      await api.post(`/super/events/${id}/reject`, { reason });
      showToast('Événement rejeté'); setDetail(null); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const archiveEvent = async (id) => {
    try {
      await api.post(`/super/events/${id}/archive`, {});
      showToast('Événement archivé'); setDetail(null); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const unarchiveEvent = async (id) => {
    try {
      await api.post(`/super/events/${id}/unarchive`, {});
      showToast('Événement désarchivé'); setDetail(null); load(page);
      return null;
    } catch (err) {
      if (err.response?.data?.code === 'date_passed') return 'date_passed';
      alert(err.response?.data?.error || 'Erreur');
      return null;
    }
  };

  const deleteEvent = async (id) => {
    try {
      await api.delete(`/super/events/${id}`);
      showToast('Événement supprimé'); setDetail(null); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const publishQuick = async (id) => {
    try {
      await api.post(`/super/events/${id}/publish`, {});
      showToast('Événement publié'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const archiveQuick = async (id) => {
    try {
      await api.post(`/super/events/${id}/archive`, {});
      showToast('Événement archivé'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const unarchiveQuick = async (id) => {
    try {
      await api.post(`/super/events/${id}/unarchive`, {});
      showToast('Événement désarchivé'); load(page);
    } catch (err) {
      const msg = err.response?.data?.code === 'date_passed'
        ? "La date est passée. Modifiez la date avant de désarchiver."
        : (err.response?.data?.error || 'Erreur');
      alert(msg);
    }
  };

  const handleReject = async (reason) => {
    try {
      await api.post(`/super/events/${confirm.id}/reject`, { reason });
      showToast('Événement rejeté'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/super/events/${confirm.id}`);
      showToast('Événement supprimé'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Agenda</h1>
          <p className={styles.managerSub}>Gestion de tous les événements ({total} total)</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setFormTarget('create')}>+ Créer un événement</button>
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
          placeholder="Rechercher par titre ou catégorie…"
          className={styles.input} style={{ maxWidth: 320 }} />
        <button className={styles.btnSecondary} onClick={() => load(1)}>Rechercher</button>
        {search && <button className={styles.btnSecondary} onClick={() => setSearch('')}>✕</button>}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Titre</th><th>Date</th><th>Hôtel</th><th>Créé par</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Chargement…</td></tr>
            ) : events.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}>
                <div className={styles.emptyIcon}>🗓️</div>
                <div className={styles.emptyText}>Aucun événement</div>
              </div></td></tr>
            ) : events.map(ev => {
              const st = STATUS_STYLE[ev.status] || STATUS_STYLE.pending;
              return (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 600 }}>{ev.title || ev.slug}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>
                    {ev.start_date ? new Date(ev.start_date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{ev.hotel_noms || 'Global'}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{ev.created_by_email || '—'}</td>
                  <td><span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  <td>
                    <div className={styles.tdActions}>
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => openDetail(ev.id)}>Voir</button>
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => openEdit(ev.id)}>Modifier</button>
                      {(ev.status === 'pending' || ev.status === 'pre_approved') && (
                        <>
                          <button className={styles.btnPrimary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => publishQuick(ev.id)}>Publier</button>
                          <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => setConfirm({ id: ev.id, mode: 'reject', title: ev.title || ev.slug })}>
                            Rejeter</button>
                        </>
                      )}
                      {ev.status === 'published' && (
                        <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => archiveQuick(ev.id)}>Archiver</button>
                      )}
                      {ev.status === 'archived' && (
                        <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                          onClick={() => unarchiveQuick(ev.id)}>Désarchiver</button>
                      )}
                      <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => setConfirm({ id: ev.id, mode: 'delete', title: ev.title || ev.slug })}>
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
        <EventFormModal
          initial={formTarget === 'create' ? null : formTarget}
          categories={eventCats}
          onClose={() => setFormTarget(null)}
          onSaved={() => {
            setFormTarget(null);
            showToast(formTarget === 'create' ? 'Événement publié' : 'Événement modifié');
            load(page);
          }}
        />
      )}

      {detail && !detail.loading && (
        <DetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onPublish={publish}
          onReject={rejectEvent}
          onArchive={archiveEvent}
          onUnarchive={unarchiveEvent}
          onDelete={deleteEvent}
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
        title="Rejeter cet événement"
        message={`Événement : ${confirm?.title}`}
        mode="reason"
        danger
        onConfirm={handleReject}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.mode === 'delete'}
        title="Supprimer cet événement ?"
        message={`Cette action est irréversible. Événement : "${confirm?.title}"`}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
