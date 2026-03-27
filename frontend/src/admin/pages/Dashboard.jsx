import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api    from '../useAdminApi';
import styles from '../Admin.module.css';

const SECTION_LABELS = {
  weather:  '☁️ Météo',
  flights:  '✈️ Vols',
  wellness: '💆 Bien-être',
  events:   '🗓️ Agenda',
  map:      '🗺️ Carte',
  info:     '📞 Infos',
  mobile:   '📱 Mobile',
};

export default function Dashboard() {
  const [stats,     setStats]     = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [anaLoading, setAnaLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/wellness').catch(() => ({ data: [] })),
      api.get('/events').catch(() => ({ data: [] })),
      api.get('/notifications').catch(() => ({ data: [] })),
      api.get('/poi').catch(() => ({ data: [] })),
      api.get('/info').catch(() => ({ data: [] })),
    ]).then(([w, ev, n, p, inf]) => setStats({
      wellness:      w.data.length,
      events:        ev.data.filter(e => e.is_active).length,
      notifications: n.data.filter(n => n.is_active).length,
      poi:           p.data.filter(p => p.is_active).length,
      info:          inf.data.length,
    }));
  }, []);

  useEffect(() => {
    api.get('/analytics?days=7')
      .then(r => setAnalytics(r.data))
      .catch(() => setAnalytics(null))
      .finally(() => setAnaLoading(false));
  }, []);

  const cards = [
    { icon: '💆', label: 'Services bien-être', value: stats?.wellness,      to: '/admin/wellness'       },
    { icon: '🗓️', label: 'Événements actifs',  value: stats?.events,        to: '/admin/events'         },
    { icon: '🔔', label: 'Notifications actives', value: stats?.notifications, to: '/admin/notifications' },
    { icon: '🗺️', label: 'Points d\'intérêt',  value: stats?.poi,           to: '/admin/map'            },
    { icon: '📞', label: 'Contacts utiles',    value: stats?.info,          to: '/admin/info'           },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Tableau de bord</h2>
          <p className={styles.pageSubtitle}>Vue d'ensemble du contenu ConnectBé</p>
        </div>
        <Link to="/admin/theme" className={styles.btnPrimary} style={{ textDecoration: 'none' }}>
          🎨 Modifier le thème
        </Link>
      </div>

      {/* ── Cartes de stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 28 }}>
        {cards.map(c => (
          <Link key={c.label} to={c.to} style={{ textDecoration: 'none' }}>
            <div className={styles.statCard} style={{ transition: 'box-shadow 0.15s', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(194,120,42,0.15)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = ''}>
              <div className={styles.statIcon}>{c.icon}</div>
              <div className={styles.statValue}>{stats ? c.value : '…'}</div>
              <div className={styles.statLabel}>{c.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* ── Analytics 7 jours ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontWeight: 800, fontSize: '1rem' }}>📈 Interactions (7 derniers jours)</h3>
            {analytics && (
              <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                {analytics.total_events} événements · {analytics.total_sessions} sessions
              </span>
            )}
          </div>
          {anaLoading ? (
            <p style={{ color: '#9CA3AF', fontSize: '0.85rem' }}>Chargement…</p>
          ) : !analytics || analytics.bySection?.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>📊</div>
              <p className={styles.emptyText}>Aucune interaction enregistrée encore.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {analytics.bySection.map(row => {
                const pct = analytics.total_events > 0
                  ? Math.round((row.total / analytics.total_events) * 100) : 0;
                return (
                  <div key={row.section}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        {SECTION_LABELS[row.section] || row.section}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                        {row.total} <span style={{ color: '#9CA3AF' }}>({row.unique_sessions} sessions)</span>
                      </span>
                    </div>
                    <div style={{ background: '#F3F4F6', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 6,
                        background: '#C2782A',
                        width: `${pct}%`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Accès rapide ── */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: 24 }}>
          <h3 style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 20 }}>⚡ Accès rapide</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { to: '/admin/events',        icon: '➕', label: 'Ajouter un événement'   },
              { to: '/admin/wellness',      icon: '➕', label: 'Ajouter un service'     },
              { to: '/admin/notifications', icon: '📢', label: 'Gérer les notifications'},
              { to: '/admin/map',           icon: '📍', label: 'Gérer les POI'          },
              { to: '/admin/info',          icon: '📞', label: 'Gérer les contacts'     },
              { to: '/admin/theme',         icon: '🎨', label: 'Personnaliser le thème' },
            ].map(item => (
              <Link key={item.to} to={item.to} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 10,
                  border: '1px solid #E5E7EB', cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FFF7ED'; e.currentTarget.style.borderColor = '#C2782A'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
                  <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1E1004' }}>{item.label}</span>
                </div>
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #E5E7EB' }}>
            <a href="/" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: '#FFF7ED', border: '1px solid #C2782A', cursor: 'pointer',
              }}>
                <span style={{ fontSize: '1.1rem' }}>👁</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#C2782A' }}>
                  Prévisualiser la borne
                </span>
              </div>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
