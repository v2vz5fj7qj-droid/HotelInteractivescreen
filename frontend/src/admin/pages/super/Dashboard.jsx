import React, { useEffect, useState } from 'react';
import api from '../../useAdminApi';
import ConfirmModal from '../../components/ConfirmModal';
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

const ENDPOINT_MAP = { 'Lieu': 'places', 'Événement': 'events', 'Info utile': 'info' };

export default function SuperDashboard() {
  const [hotels,  setHotels]  = useState([]);
  const [users,   setUsers]   = useState([]);
  const [tokens,  setTokens]  = useState(null);
  const [pending, setPending] = useState({ places: [], events: [], info: [] });
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null); // { id, type, title }

  useEffect(() => {
    const load = async () => {
      try {
        const [h, u, t, pl, ev, inf] = await Promise.allSettled([
          api.get('/super/hotels'),
          api.get('/super/users'),
          api.get('/super/tokens'),
          api.get('/super/places', { params: { status: 'pending', per_page: 50 } }),
          api.get('/super/events', { params: { status: 'pending', per_page: 50 } }),
          api.get('/super/info',   { params: { status: 'pending', per_page: 50 } }),
        ]);
        if (h.status  === 'fulfilled') setHotels(Array.isArray(h.value.data) ? h.value.data : []);
        if (u.status  === 'fulfilled') setUsers(Array.isArray(u.value.data) ? u.value.data : []);
        if (t.status  === 'fulfilled') setTokens(t.value.data);
        setPending({
          places: pl.status === 'fulfilled' ? (pl.value.data?.data || []) : [],
          events: ev.status === 'fulfilled' ? (ev.value.data?.data || []) : [],
          info:   inf.status === 'fulfilled' ? (inf.value.data?.data || []) : [],
        });
      } finally { setLoading(false); }
    };
    load();
  }, []); // eslint-disable-line

  const allPending = [
    ...pending.places.map(p => ({ ...p, _type: 'Lieu' })),
    ...pending.events.map(e => ({ ...e, _type: 'Événement' })),
    ...pending.info.map(i   => ({ ...i, _type: 'Info utile' })),
  ];

  const publish = async (id, type) => {
    const ep = ENDPOINT_MAP[type];
    try {
      await api.post(`/super/${ep}/${id}/publish`, {});
      const key = ep === 'places' ? 'places' : ep === 'events' ? 'events' : 'info';
      setPending(prev => ({ ...prev, [key]: prev[key].filter(x => x.id !== id) }));
    } catch {}
  };

  const handleReject = async (reason) => {
    const { id, type } = confirm;
    const ep  = ENDPOINT_MAP[type];
    const key = ep === 'places' ? 'places' : ep === 'events' ? 'events' : 'info';
    try {
      await api.post(`/super/${ep}/${id}/reject`, { reason });
      setPending(prev => ({ ...prev, [key]: prev[key].filter(x => x.id !== id) }));
    } catch {}
    setConfirm(null);
  };

  const activeHotels = hotels.filter(h => h.is_active !== 0).length;
  const activeUsers  = users.filter(u => u.is_active !== 0).length;
  const tokenPct     = tokens ? Math.round((tokens.used_tokens / tokens.total_tokens) * 100) : 0;

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Tableau de bord</h1>
          <p className={styles.managerSub}>Vue d'ensemble de la plateforme ConnectBé</p>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon="🏨" value={activeHotels} label="Hôtels actifs" />
        <StatCard icon="👤" value={activeUsers}  label="Utilisateurs actifs" />
        <StatCard icon="⏳" value={allPending.length} label="Soumissions en attente"
          color={allPending.length > 0 ? '#D97706' : undefined} />
        <StatCard icon="🔑"
          value={tokens ? `${tokenPct}%` : '—'}
          label={tokens ? `${tokens.used_tokens.toLocaleString()} / ${tokens.total_tokens.toLocaleString()} tokens` : 'Tokens API'}
          color={tokenPct > 80 ? '#EF4444' : tokenPct > 60 ? '#D97706' : undefined} />
      </div>

      {tokens?.alert_triggered && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 24, color: '#991B1B', fontSize: '0.88rem', fontWeight: 600 }}>
          ⚠️ Alerte tokens : seuil de {tokens.alert_threshold} atteint. Pensez à renouveler votre token FlightAPI.io.
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Soumissions en attente de validation</span>
          <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>{allPending.length} élément{allPending.length !== 1 ? 's' : ''}</span>
        </div>
        {allPending.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>✅</div>
            <div className={styles.emptyText}>Aucune soumission en attente</div>
          </div>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>Type</th><th>Titre</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {allPending.map(item => {
                const title = item.title || item.name || item.slug || `#${item.id}`;
                return (
                  <tr key={`${item._type}-${item.id}`}>
                    <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{item._type}</td>
                    <td style={{ fontWeight: 600 }}>{title}</td>
                    <td><span className={styles.badge} style={{ background: '#FEF3C7', color: '#92400E' }}>En attente</span></td>
                    <td>
                      <div className={styles.tdActions}>
                        <button className={styles.btnPrimary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                          onClick={() => publish(item.id, item._type)}>Publier</button>
                        <button className={styles.btnDanger} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                          onClick={() => setConfirm({ id: item.id, type: item._type, title })}>
                          Rejeter
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: '0.95rem' }}>
          Hôtels enregistrés
        </div>
        <table className={styles.table}>
          <thead><tr><th>Nom</th><th>Slug</th><th>Statut</th></tr></thead>
          <tbody>
            {hotels.length === 0 ? (
              <tr><td colSpan={3}><div className={styles.empty}><div className={styles.emptyText}>Aucun hôtel</div></div></td></tr>
            ) : hotels.map(h => (
              <tr key={h.id}>
                <td style={{ fontWeight: 600 }}>{h.nom}</td>
                <td style={{ fontFamily: 'monospace', color: '#6B7280', fontSize: '0.82rem' }}>{h.slug}</td>
                <td><span className={`${styles.badge} ${h.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                  {h.is_active ? 'Actif' : 'Inactif'}
                </span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!confirm}
        title={`Rejeter — ${confirm?.title}`}
        message={`Type : ${confirm?.type}`}
        mode="reason"
        danger
        onConfirm={handleReject}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
