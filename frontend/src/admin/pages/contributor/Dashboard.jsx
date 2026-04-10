import React, { useEffect, useState } from 'react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

const STATUS_STYLE = {
  pending:      { bg: '#FEF3C7', color: '#92400E', label: 'En attente' },
  pre_approved: { bg: '#DBEAFE', color: '#1E40AF', label: 'Pré-approuvé' },
  published:    { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:     { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
  archived:     { bg: '#F3F4F6', color: '#6B7280', label: 'Archivé' },
};

function Section({ title, icon, items, labelKey }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: '0.95rem' }}>
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <div className={styles.empty}><div className={styles.emptyText}>Aucune soumission</div></div>
      ) : (
        <table className={styles.table}>
          <thead><tr><th>Titre</th><th>Statut</th><th>Soumis le</th></tr></thead>
          <tbody>
            {items.map(item => {
              const st = STATUS_STYLE[item.status] || STATUS_STYLE.pending;
              return (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item[labelKey] || item.slug || item.name || `#${item.id}`}</td>
                  <td><span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  <td style={{ color: '#6B7280' }}>
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ContributorDashboard() {
  const { user } = useAuth();
  const [places,  setPlaces]  = useState([]);
  const [events,  setEvents]  = useState([]);
  const [info,    setInfo]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [pl, ev, inf] = await Promise.allSettled([
          api.get('/contributor/places'),
          api.get('/contributor/events'),
          api.get('/contributor/info'),
        ]);
        if (pl.status  === 'fulfilled') setPlaces(pl.value.data  || []);
        if (ev.status  === 'fulfilled') setEvents(ev.value.data  || []);
        if (inf.status === 'fulfilled') setInfo(inf.value.data   || []);
      } finally { setLoading(false); }
    };
    load();
  }, []); // eslint-disable-line

  const total     = places.length + events.length + info.length;
  const published = [...places, ...events, ...info].filter(x => x.status === 'published').length;
  const pending   = [...places, ...events, ...info].filter(x => x.status === 'pending').length;
  const rejected  = [...places, ...events, ...info].filter(x => x.status === 'rejected').length;

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Mes soumissions</h1>
          <p className={styles.managerSub}>Suivez l'état de vos contributions</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}><div className={styles.statIcon}>📋</div><div className={styles.statValue}>{total}</div><div className={styles.statLabel}>Total soumissions</div></div>
        <div className={styles.statCard}><div className={styles.statIcon}>✅</div><div className={styles.statValue} style={{ color: '#065F46' }}>{published}</div><div className={styles.statLabel}>Publiées</div></div>
        <div className={styles.statCard}><div className={styles.statIcon}>⏳</div><div className={styles.statValue} style={pending > 0 ? { color: '#D97706' } : {}}>{pending}</div><div className={styles.statLabel}>En attente</div></div>
        <div className={styles.statCard}><div className={styles.statIcon}>❌</div><div className={styles.statValue} style={rejected > 0 ? { color: '#EF4444' } : {}}>{rejected}</div><div className={styles.statLabel}>Rejetées</div></div>
      </div>

      {rejected > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 24, fontSize: '0.88rem', color: '#991B1B', fontWeight: 600 }}>
          ⚠️ {rejected} soumission{rejected > 1 ? 's ont' : ' a'} été rejetée{rejected > 1 ? 's' : ''}.
          Corrigez-les et re-soumettez depuis les sections correspondantes.
        </div>
      )}

      {user?.can_submit_places  && <Section title="Mes lieux"        icon="🗺️" items={places} labelKey="name" />}
      {user?.can_submit_events  && <Section title="Mes événements"   icon="🗓️" items={events} labelKey="title" />}
      {user?.can_submit_info    && <Section title="Mes infos utiles" icon="📞" items={info}   labelKey="name" />}

      {!user?.can_submit_places && !user?.can_submit_events && !user?.can_submit_info && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🔒</div>
          <div className={styles.emptyText}>Aucune permission de soumission active.<br />Contactez votre administrateur.</div>
        </div>
      )}
    </div>
  );
}
