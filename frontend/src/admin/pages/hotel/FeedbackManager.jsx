import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import { useSuperHotelId, useHotelSlug } from '../../components/SuperHotelSelector';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';
import { exportFeedbackPDF } from '../../utils/exportFeedbackPDF';

const CAT_KEYS = ['proprete', 'accueil', 'chambre', 'restauration', 'services'];

function computeFilteredStats(rows) {
  if (!rows.length) return { total: 0, moyenne_globale: null };
  const sums = Object.fromEntries(CAT_KEYS.map(c => [c, { sum: 0, count: 0 }]));
  let totalNote = 0;
  for (const r of rows) {
    totalNote += parseFloat(r.note_globale) || 0;
    const c = typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || {});
    for (const cat of CAT_KEYS) {
      if (c[cat] != null) { sums[cat].sum += parseFloat(c[cat]); sums[cat].count++; }
    }
  }
  const result = { total: rows.length, moyenne_globale: (totalNote / rows.length).toFixed(2) };
  for (const cat of CAT_KEYS) {
    result[`moy_${cat}`] = sums[cat].count ? (sums[cat].sum / sums[cat].count).toFixed(2) : null;
  }
  return result;
}

const CATEGORIES = [
  { key: 'proprete',     label: 'Propreté'     },
  { key: 'accueil',      label: 'Accueil'      },
  { key: 'chambre',      label: 'Chambre'      },
  { key: 'restauration', label: 'Restauration' },
  { key: 'services',     label: 'Services'     },
];

// Couleur de la note : vert (bon), orange (moyen), rouge (à surveiller)
function ratingColor(note) {
  const v = parseFloat(note) || 0;
  if (v >= 4) return '#10B981';
  if (v >= 3) return '#F59E0B';
  return '#EF4444';
}

function RatingBadge({ value }) {
  const v = parseFloat(value) || 0;
  return (
    <div
      title={`${v}/5`}
      style={{
        width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
        background: ratingColor(v), color: '#fff', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.84rem',
      }}
    >
      {v.toFixed(1)}
    </div>
  );
}

function StatBar({ label, value, color = '#C2782A' }) {
  const pct = value ? (parseFloat(value) / 5) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.88rem', color: '#1E1004' }}>{label}</span>
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color }}>{value ? parseFloat(value).toFixed(2) : '—'}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: '#E5E7EB' }}>
        <div style={{ height: '100%', borderRadius: 4, background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

export default function FeedbackManager() {
  const { user }  = useAuth();
  const hotelId   = useSuperHotelId(user);
  const hotelSlug = useHotelSlug(user);

  const [rows,    setRows]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [page,    setPage]    = useState(0);

  const [from,        setFrom]        = useState('');
  const [to,          setTo]          = useState('');
  const [minNote,     setMinNote]     = useState('');
  const [hasComment,  setHasComment]  = useState(false);
  const [search,      setSearch]      = useState('');
  const [expanded,    setExpanded]    = useState(() => new Set());
  const [pdfLoading,  setPdfLoading]  = useState(false);

  const LIMIT = 20;

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset: p * LIMIT, hotel_id: hotelId };
      if (from)             params.from        = from;
      if (to)               params.to          = to;
      if (minNote)          params.min_note    = minNote;
      if (hasComment)       params.has_comment = 1;
      if (search.trim())    params.q           = search.trim();

      const [listRes, statsRes] = await Promise.all([
        api.get('/hotel/feedbacks',       { params }),
        api.get('/hotel/feedbacks/stats', { params: { hotel_id: hotelId } }),
      ]);
      setRows(listRes.data.rows);
      setTotal(listRes.data.total);
      setStats(statsRes.data);
      setPage(p);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [from, to, minNote, hasComment, search, hotelId]);

  useEffect(() => { load(0); }, [load]);

  const toggleExpanded = (id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setFrom(''); setTo(''); setMinNote(''); setHasComment(false); setSearch('');
  };

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const now      = new Date();
      const datePart = now.toISOString().slice(0, 10);
      const timePart = now.toTimeString().slice(0, 5).replace(':', 'h');
      const filename = `feedbacks_${hotelSlug || hotelId}_${datePart}_${timePart}`;

      const params = { hotel_id: hotelId, limit: 5000, offset: 0 };
      if (from)          params.from        = from;
      if (to)            params.to          = to;
      if (minNote)       params.min_note    = minNote;
      if (hasComment)    params.has_comment = 1;
      if (search.trim()) params.q           = search.trim();

      const [rowsRes, settingsRes] = await Promise.all([
        api.get('/hotel/feedbacks', { params }),
        api.get('/hotel/settings',  { params: { hotel_id: hotelId } }),
      ]);
      const allRows  = rowsRes.data.rows;
      const settings = settingsRes.data;
      const colors   = settings.theme_colors
        ? (typeof settings.theme_colors === 'string' ? JSON.parse(settings.theme_colors) : settings.theme_colors)
        : {};
      const origin   = window.location.origin;

      await exportFeedbackPDF({
        rows:         allRows,
        stats:        computeFilteredStats(allRows),
        hotelName:    settings.nom || hotelSlug || 'Hôtel',
        logoUrl:      settings.logo_url     ? `${origin}${settings.logo_url}`     : null,
        primaryColor: colors.color_primary  || '#C2782A',
        fontPrimary:  settings.font_primary || 'Poppins',
        fontFileUrl:  settings.font_file_url ? `${origin}${settings.font_file_url}` : null,
        filters:      { from, to, minNote },
        filename,
      });
    } catch (e) {
      console.error('PDF export error', e);
      alert('Erreur lors de la génération du PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExport = async () => {
    const params = new URLSearchParams({ hotel_id: hotelId });
    if (from)          params.set('from',        from);
    if (to)            params.set('to',          to);
    if (minNote)       params.set('min_note',    minNote);
    if (hasComment)    params.set('has_comment', '1');
    if (search.trim()) params.set('q',           search.trim());
    const now      = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 5).replace(':', 'h');
    const filename = `feedbacks_${hotelSlug || hotelId}_${datePart}_${timePart}.csv`;

    // credentials 'same-origin' (défaut fetch) suffit : le cookie HttpOnly admin_token
    // est envoyé automatiquement, pas besoin de header Authorization manuel.
    const url = `/api/admin/hotel/feedbacks/export?${params}`;
    const res = await fetch(url);
    const blob  = await res.blob();
    const a     = document.createElement('a');
    a.href      = URL.createObjectURL(blob);
    a.download  = filename;
    a.click();
  };

  const pages = Math.ceil(total / LIMIT);
  const pctAvecCommentaire = stats?.total ? Math.round((stats.avec_commentaire / stats.total) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1E1004' }}>⭐ Évaluations clients</h2>
          <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '0.88rem' }}>
            {total} avis reçus
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={styles.btnSecondary} onClick={handleExport}>
            ⬇ CSV
          </button>
          <button className={styles.btnPrimary} onClick={handleExportPDF} disabled={pdfLoading}>
            {pdfLoading ? '⏳ Génération…' : '📄 PDF'}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard} style={{ textAlign: 'center' }}>
            <p className={styles.statLabel} style={{ marginBottom: 6 }}>Note globale</p>
            <p className={styles.statValue} style={{ color: '#F59E0B' }}>
              {stats.moyenne_globale ? parseFloat(stats.moyenne_globale).toFixed(2) : '—'}
            </p>
            <p style={{ margin: '6px 0 0', color: '#F59E0B', fontSize: '1rem' }}>
              {'★'.repeat(Math.round(stats.moyenne_globale || 0))}{'☆'.repeat(5 - Math.round(stats.moyenne_globale || 0))}
            </p>
          </div>
          <div className={styles.statCard} style={{ textAlign: 'center' }}>
            <p className={styles.statLabel} style={{ marginBottom: 6 }}>Total avis</p>
            <p className={styles.statValue}>{stats.total || 0}</p>
          </div>
          <div className={styles.statCard} style={{ textAlign: 'center' }}>
            <p className={styles.statLabel} style={{ marginBottom: 6 }}>Avec commentaire</p>
            <p className={styles.statValue}>{pctAvecCommentaire}%</p>
          </div>
          <div className={styles.statCard} style={{ textAlign: 'center', borderColor: stats.a_surveiller > 0 ? '#FCA5A5' : undefined }}>
            <p className={styles.statLabel} style={{ marginBottom: 6 }}>À surveiller</p>
            <p className={styles.statValue} style={{ color: stats.a_surveiller > 0 ? '#EF4444' : '#1E1004' }}>
              {stats.a_surveiller || 0}
            </p>
          </div>
        </div>
      )}

      {/* ── Barres par catégorie ── */}
      {stats && (
        <div className={styles.card} style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>
            Par catégorie
          </p>
          {CATEGORIES.map(c => (
            <StatBar key={c.key} label={c.label} value={stats[`moy_${c.key}`]} />
          ))}
        </div>
      )}

      {/* ── Filtres ── */}
      <div className={styles.card} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 20, padding: '16px 20px', flexWrap: 'wrap' }}>
        <div className={styles.field}>
          <span className={styles.label}>Du</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={styles.input} style={{ width: 155 }} />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Au</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={styles.input} style={{ width: 155 }} />
        </div>
        <div className={styles.field}>
          <span className={styles.label}>Note min.</span>
          <select value={minNote} onChange={e => setMinNote(e.target.value)} className={styles.input} style={{ width: 130 }}>
            <option value="">Toutes</option>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
          </select>
        </div>
        <div className={styles.field} style={{ flex: 1, minWidth: 200 }}>
          <span className={styles.label}>Rechercher</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Dans les commentaires…"
            className={styles.input}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#1E1004', paddingBottom: 10 }}>
          <input type="checkbox" checked={hasComment} onChange={e => setHasComment(e.target.checked)} />
          Avec commentaire uniquement
        </label>
        <button className={styles.btnPrimary} onClick={() => load(0)}>Filtrer</button>
        <button className={styles.btnSecondary} onClick={resetFilters}>Réinitialiser</button>
      </div>

      {/* ── Liste des avis ── */}
      {loading ? (
        <p style={{ color: '#6B7280' }}>Chargement…</p>
      ) : rows.length === 0 ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
          <p style={{ fontSize: '2rem' }}>📭</p>
          <p>Aucun avis pour cette période</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map(r => {
            const cats      = typeof r.categories === 'string' ? JSON.parse(r.categories) : r.categories;
            const note      = parseFloat(r.note_globale) || 0;
            const isLow     = note < 3;
            const comment   = r.commentaire;
            const isLong    = !!comment && comment.length > 160;
            const isOpen    = expanded.has(r.id);
            const created   = new Date(r.created_at);

            return (
              <div key={r.id} className={styles.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <RatingBadge value={r.note_globale} />
                    <div>
                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#1E1004' }}>
                        {created.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#6B7280' }}>
                        {created.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {isLow && (
                      <span className={`${styles.badge} ${styles.badgeInactive}`}>⚠ À suivre</span>
                    )}
                  </div>
                  <span className={styles.badge} style={{ background: '#F4F6F9', color: '#6B7280' }}>
                    {(r.locale || '').toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.filter(c => cats[c.key] != null).map(c => (
                    <span
                      key={c.key}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                        background: '#F4F6F9', border: '1px solid #E5E7EB', borderRadius: 9999,
                        fontSize: '0.76rem', fontWeight: 600, color: '#1E1004', whiteSpace: 'nowrap',
                      }}
                    >
                      {c.label} {'★'.repeat(cats[c.key])}
                    </span>
                  ))}
                </div>

                {comment ? (
                  <div>
                    <p
                      style={{
                        margin: 0, fontSize: '0.9rem', color: '#1E1004', lineHeight: 1.5,
                        ...(isLong && !isOpen
                          ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                          : {}),
                      }}
                    >
                      « {comment} »
                    </p>
                    {isLong && (
                      <button
                        onClick={() => toggleExpanded(r.id)}
                        style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, color: '#C2782A', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        {isOpen ? 'Réduire ‹' : 'Voir le commentaire complet ›'}
                      </button>
                    )}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#9CA3AF', fontStyle: 'italic' }}>
                    Aucun commentaire laissé
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'center' }}>
          <button
            className={styles.btnSecondary}
            disabled={page === 0}
            onClick={() => load(page - 1)}
          >
            ← Précédent
          </button>
          <span style={{ padding: '8px 14px', color: '#6B7280', fontSize: '0.88rem' }}>
            {page + 1} / {pages}
          </span>
          <button
            className={styles.btnSecondary}
            disabled={page >= pages - 1}
            onClick={() => load(page + 1)}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
