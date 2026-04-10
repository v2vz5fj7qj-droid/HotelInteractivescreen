import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

function StatCard({ icon, value, label, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue} style={color ? { color } : {}}>{value ?? '—'}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

const STATUS_STYLE = {
  pending:      { bg: '#FEF3C7', color: '#92400E', label: 'En attente' },
  pre_approved: { bg: '#DBEAFE', color: '#1E40AF', label: 'Pré-approuvé' },
  published:    { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:     { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
  archived:     { bg: '#F3F4F6', color: '#6B7280', label: 'Archivé' },
};

export default function HotelDashboard() {
  const { user } = useAuth();
  const [services,  setServices]  = useState([]);
  const [events,    setEvents]    = useState([]);
  const [tips,      setTips]      = useState([]);
  const [notifs,    setNotifs]    = useState([]);
  const [pending,   setPending]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  const headers = { Authorization: `Bearer ${user?.token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const [sv, ev, tp, nt, pd] = await Promise.allSettled([
          axios.get('/api/admin/hotel/services',      { headers }),
          axios.get('/api/admin/hotel/events',        { headers }),
          axios.get('/api/admin/hotel/tips',          { headers }),
          axios.get('/api/admin/hotel/notifications', { headers }),
          axios.get('/api/admin/hotel/events/pending', { headers }),
        ]);
        if (sv.status === 'fulfilled') setServices(sv.value.data || []);
        if (ev.status === 'fulfilled') setEvents(ev.value.data || []);
        if (tp.status === 'fulfilled') setTips(tp.value.data || []);
        if (nt.status === 'fulfilled') setNotifs(nt.value.data || []);
        if (pd.status === 'fulfilled') setPending(pd.value.data || []);
      } finally { setLoading(false); }
    };
    load();
  }, []); // eslint-disable-line

  const activeNotifs = notifs.filter(n => n.is_active).length;
  const pubEvents    = events.filter(e => e.status === 'published').length;

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Tableau de bord</h1>
          <p className={styles.managerSub}>Gestion de votre hôtel</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="💆" value={services.length}   label="Services actifs" />
        <StatCard icon="🗓️" value={pubEvents}          label="Événements publiés" />
        <StatCard icon="💡" value={tips.length}        label="Bons à savoir" />
        <StatCard icon="🔔" value={activeNotifs}       label="Notifications actives"
          color={activeNotifs > 0 ? '#C2782A' : undefined} />
      </div>

      {/* Pending submissions from staff/contributors */}
      {pending.length > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10,
          padding: '12px 16px', marginBottom: 24, fontSize: '0.88rem', color: '#92400E', fontWeight: 600 }}>
          ⏳ {pending.length} soumission{pending.length > 1 ? 's' : ''} en attente de votre pré-approbation
        </div>
      )}

      {/* Recent events */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: '0.95rem' }}>
          Derniers événements
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th>Titre</th><th>Date</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr><td colSpan={3}><div className={styles.empty}><div className={styles.emptyText}>Aucun événement</div></div></td></tr>
            ) : events.slice(0, 8).map(ev => {
              const st = STATUS_STYLE[ev.status] || STATUS_STYLE.pending;
              return (
                <tr key={ev.id}>
                  <td style={{ fontWeight: 600 }}>{ev.title || ev.slug}</td>
                  <td style={{ color: '#6B7280' }}>{ev.start_date ? new Date(ev.start_date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td><span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Active notifications */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: '0.95rem' }}>
          Notifications borne actives
        </div>
        {notifs.filter(n => n.is_active).length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔔</div>
            <div className={styles.emptyText}>Aucune notification active</div>
          </div>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>Message (FR)</th><th>Type</th><th>Expire</th></tr></thead>
            <tbody>
              {notifs.filter(n => n.is_active).map(n => (
                <tr key={n.id}>
                  <td style={{ fontWeight: 500 }}>{n.message_fr || '—'}</td>
                  <td>{n.type || '—'}</td>
                  <td style={{ color: '#6B7280' }}>{n.expires_at ? new Date(n.expires_at).toLocaleDateString('fr-FR') : 'Illimité'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
