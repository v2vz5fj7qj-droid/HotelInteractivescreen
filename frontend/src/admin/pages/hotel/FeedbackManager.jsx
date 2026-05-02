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

function Stars({ value }) {
  const v = parseFloat(value) || 0;
  return (
    <span title={`${v}/5`} style={{ color: '#F59E0B', letterSpacing: 1, fontSize: '1.1rem' }}>
      {'★'.repeat(Math.round(v))}{'☆'.repeat(5 - Math.round(v))}
      <span style={{ fontSize: '0.8rem', color: '#9CA3AF', marginLeft: 4 }}>{v.toFixed(1)}</span>
    </span>
  );
}

function StatBar({ label, value, color = '#C2782A' }) {
  const pct = value ? (parseFloat(value) / 5) * 100 : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.88rem', color: '#D1D5DB' }}>{label}</span>
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color }}>{value ? parseFloat(value).toFixed(2) : '—'}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
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

  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');
  const [minNote,    setMinNote]    = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const LIMIT = 20;

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset: p * LIMIT, hotel_id: hotelId };
      if (from)    params.from     = from;
      if (to)      params.to       = to;
      if (minNote) params.min_note = minNote;

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
  }, [from, to, minNote, hotelId]);

  useEffect(() => { load(0); }, [load]);

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const now      = new Date();
      const datePart = now.toISOString().slice(0, 10);
      const timePart = now.toTimeString().slice(0, 5).replace(':', 'h');
      const filename = `feedbacks_${hotelSlug || hotelId}_${datePart}_${timePart}`;

      const params = { hotel_id: hotelId, limit: 5000, offset: 0 };
      if (from)    params.from     = from;
      if (to)      params.to       = to;
      if (minNote) params.min_note = minNote;

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
    if (from)    params.set('from',     from);
    if (to)      params.set('to',       to);
    if (minNote) params.set('min_note', minNote);
    const now      = new Date();
    const datePart = now.toISOString().slice(0, 10);
    const timePart = now.toTimeString().slice(0, 5).replace(':', 'h');
    const filename = `feedbacks_${hotelSlug || hotelId}_${datePart}_${timePart}.csv`;

    const token = sessionStorage.getItem('admin_token');
    const url   = `/api/admin/hotel/feedbacks/export?${params}`;
    const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const blob  = await res.blob();
    const a     = document.createElement('a');
    a.href      = URL.createObjectURL(blob);
    a.download  = filename;
    a.click();
  };

  const pages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#F5E6C8' }}>⭐ Évaluations clients</h2>
          <p style={{ margin: '4px 0 0', color: '#9CA3AF', fontSize: '0.88rem' }}>
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
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28,
        }}>
          {/* Note globale */}
          <div className={styles.card} style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '0.8rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>
              Note globale
            </p>
            <p style={{ margin: 0, fontSize: '3rem', fontWeight: 800, color: '#F59E0B', lineHeight: 1 }}>
              {stats.moyenne_globale ? parseFloat(stats.moyenne_globale).toFixed(2) : '—'}
            </p>
            <p style={{ margin: '6px 0 0', color: '#F59E0B', fontSize: '1.4rem' }}>
              {'★'.repeat(Math.round(stats.moyenne_globale || 0))}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#6B7280' }}>
              sur {stats.total || 0} avis
            </p>
          </div>

          {/* Barres par catégorie */}
          <div className={styles.card} style={{ padding: '20px 20px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '0.82rem', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>
              Par catégorie
            </p>
            {CATEGORIES.map(c => (
              <StatBar key={c.key} label={c.label} value={stats[`moy_${c.key}`]} />
            ))}
          </div>
        </div>
      )}

      {/* ── Filtres ── */}
      <div className={styles.card} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20, padding: '14px 16px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', color: '#9CA3AF' }}>
          Du
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={styles.input} style={{ width: 150 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', color: '#9CA3AF' }}>
          Au
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={styles.input} style={{ width: 150 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', color: '#9CA3AF' }}>
          Note min.
          <select value={minNote} onChange={e => setMinNote(e.target.value)} className={styles.input} style={{ width: 120 }}>
            <option value="">Toutes</option>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
          </select>
        </label>
        <button className={styles.btnSecondary} onClick={() => load(0)}>Filtrer</button>
        <button className={styles.btnGhost} onClick={() => { setFrom(''); setTo(''); setMinNote(''); }}>
          Réinitialiser
        </button>
      </div>

      {/* ── Tableau ── */}
      {loading ? (
        <p style={{ color: '#9CA3AF' }}>Chargement…</p>
      ) : rows.length === 0 ? (
        <div className={styles.card} style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
          <p style={{ fontSize: '2rem' }}>📭</p>
          <p>Aucun avis pour cette période</p>
        </div>
      ) : (
        <div className={styles.card} style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Date', 'Note', 'Propreté', 'Accueil', 'Chambre', 'Restau.', 'Services', 'Commentaire', 'Langue'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#9CA3AF', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const cats = typeof r.categories === 'string' ? JSON.parse(r.categories) : r.categories;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', color: '#D1D5DB', whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 12px' }}><Stars value={r.note_globale} /></td>
                    {CATEGORIES.map(c => (
                      <td key={c.key} style={{ padding: '10px 12px', color: '#F59E0B', textAlign: 'center' }}>
                        {cats[c.key] != null ? `${cats[c.key]}★` : '—'}
                      </td>
                    ))}
                    <td style={{ padding: '10px 12px', color: '#D1D5DB', maxWidth: 280 }}>
                      {r.commentaire
                        ? <span title={r.commentaire}>{r.commentaire.length > 80 ? r.commentaire.slice(0, 80) + '…' : r.commentaire}</span>
                        : <span style={{ color: '#6B7280', fontStyle: 'italic' }}>—</span>
                      }
                    </td>
                    <td style={{ padding: '10px 12px', color: '#9CA3AF', textTransform: 'uppercase', fontSize: '0.78rem' }}>
                      {r.locale}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
          <span style={{ padding: '8px 14px', color: '#9CA3AF', fontSize: '0.88rem' }}>
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
