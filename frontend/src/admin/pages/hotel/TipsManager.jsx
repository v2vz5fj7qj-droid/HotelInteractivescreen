import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperHotelId } from '../../components/SuperHotelSelector';
import TranslationPanel from '../../components/TranslationPanel';
import { useTranslate } from '../../hooks/useTranslate';
import { useToast } from '../../hooks/useToast';
import styles from '../../Admin.module.css';
import localesMeta from '../../../i18n/locales.json';

const ALL_LOCALES  = Object.keys(localesMeta);
const TRANS_FIELDS = ['titre', 'contenu'];

// ── Initialise la map de traductions depuis un tip existant ────────
function initTrans(tip) {
  const map = {};
  for (const locale of ALL_LOCALES) {
    if (tip) {
      const found = tip.translations?.find(t => t.locale === locale);
      map[locale] = {
        titre:  found?.titre  || (locale === 'fr' ? tip.titre_fr  || '' : locale === 'en' ? tip.titre_en  || '' : ''),
        contenu: found?.contenu || (locale === 'fr' ? tip.contenu_fr || '' : locale === 'en' ? tip.contenu_en || '' : ''),
      };
    } else {
      map[locale] = { titre: '', contenu: '' };
    }
  }
  return map;
}

// ── Modal création / édition ──────────────────────────────────────
function TipFormModal({ tip, hotelParams, onClose, onSaved }) {
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
    const result = await translateFields(TRANS_FIELDS, sourceLang, trans[sourceLang], ALL_LOCALES);
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
      // Langues supplémentaires (hors FR/EN) dans translations_extra
      const translations_extra = {};
      for (const locale of ALL_LOCALES) {
        if (locale === 'fr' || locale === 'en') continue;
        if (trans[locale].titre?.trim() || trans[locale].contenu?.trim()) {
          translations_extra[locale] = { titre: trans[locale].titre, contenu: trans[locale].contenu };
        }
      }

      const payload = {
        titre_fr:   trans.fr.titre,
        contenu_fr: trans.fr.contenu,
        titre_en:   trans.en.titre   || null,
        contenu_en: trans.en.contenu || null,
        categorie:  categorie || null,
        display_order: order,
        translations_extra,
      };

      if (isEdit) {
        await api.put(`/hotel/tips/${tip.id}`, payload, { params: hotelParams });
      } else {
        await api.post('/hotel/tips', payload, { params: hotelParams });
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
            {isEdit ? `Modifier — ${tip.titre_fr || trans.fr.titre}` : 'Nouveau conseil'}
          </span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {/* Champs non-traduisibles */}
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

          {/* Onglets de langues */}
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

          {/* Champs traduisibles */}
          <div key={activeLang}>
            <div className={styles.field}>
              <label className={styles.label}>
                {langMeta.flag} Titre{activeLang === 'fr' ? ' *' : ''}
              </label>
              <input className={styles.input} value={curTrans.titre}
                onChange={e => setLangVal(activeLang, 'titre', e.target.value)}
                autoFocus={activeLang === 'fr'} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                {langMeta.flag} Contenu{activeLang === 'fr' ? ' *' : ''}
              </label>
              <textarea className={styles.textarea} rows={4} value={curTrans.contenu}
                onChange={e => setLangVal(activeLang, 'contenu', e.target.value)} />
            </div>
          </div>

          {/* Panneau de traduction automatique */}
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

// ── Composant principal ───────────────────────────────────────────
export default function TipsManager() {
  const { user } = useAuth();
  const hotelId  = useSuperHotelId(user);
  const params   = hotelId ? { hotel_id: hotelId } : {};

  const [tips,    setTips]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   showToast]  = useToast();
  const [modal,   setModal]   = useState(null); // null | 'create' | tip-object

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/hotel/tips', { params });
      setTips(data);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (t) => {
    await api.put(`/hotel/tips/${t.id}`, { is_active: t.is_active ? 0 : 1 }, { params });
    showToast(t.is_active ? 'Conseil désactivé' : 'Conseil activé');
    load();
  };

  const del = async (id, titre) => {
    if (!window.confirm(`Supprimer "${titre}" ?`)) return;
    await api.delete(`/hotel/tips/${id}`, { params });
    showToast('Conseil supprimé');
    load();
  };

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Bon à savoir</h1>
          <p className={styles.managerSub}>Conseils et informations utiles pour les clients</p>
        </div>
        <button className={styles.btnPrimary} onClick={() => setModal('create')}>+ Ajouter</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

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
          hotelParams={params}
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
