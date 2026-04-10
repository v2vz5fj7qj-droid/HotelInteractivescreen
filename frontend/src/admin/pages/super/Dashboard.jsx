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

function PendingRow({ item, type, onAction }) {
  const title = item.title || item.name || item.slug || `#${item.id}`;
  return (
    <tr>
      <td>{type}</td>
      <td style={{ fontWeight: 600 }}>{title}</td>
      <td><span className={styles.badge} style={{ background: '#FEF3C7', color: '#92400E' }}>En attente</span></td>
      <td>
        <div className={styles.tdActions}>
          <button className={styles.btnPrimary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
            onClick={() => onAction(item.id, type, 'publish')}>Publier</button>
          <button className={styles.btnDanger} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
            onClick={() => onAction(item.id, type, 'reject')}>Rejeter</button>
        </div>
      </td>
    </tr>
  );
}

export default function SuperDashboard() {
  const { user } = useAuth();
  const [hotels,  setHotels]  = useState([]);
  const [users,   setUsers]   = useState([]);
  const [tokens,  setTokens]  = useState(null);
  const [pending, setPending] = useState({ places: [], events: [], info: [] });
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${user?.token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const [h, u, t, pl, ev, inf] = await Promise.allSettled([
          axios.get('/api/admin/super/hotels',  { headers }),
          axios.get('/api/admin/super/users',   { headers }),
          axios.get('/api/admin/super/tokens',  { headers }),
          axios.get('/api/admin/super/places',  { headers, params: { status: 'pending' } }),
          axios.get('/api/admin/super/events',  { headers, params: { status: 'pending' } }),
          axios.get('/api/admin/super/info',    { headers, params: { status: 'pending' } }),
        ]);
        if (h.status  === 'fulfilled') setHotels(h.value.data);
        if (u.status  === 'fulfilled') setUsers(u.value.data);
        if (t.status  === 'fulfilled') setTokens(t.value.data);
        setPending({
          places: pl.status === 'fulfilled' ? (pl.value.data || []).filter(x => x.status === 'pending') : [],
          events: ev.status === 'fulfilled' ? (ev.value.data || []).filter(x => x.status === 'pending') : [],
          info:   inf.status === 'fulfilled' ? (inf.value.data || []).filter(x => x.status === 'pending') : [],
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

  const handleAction = async (id, type, action) => {
    const endpointMap = { 'Lieu': 'places', 'Événement': 'events', 'Info utile': 'info' };
    const ep = endpointMap[type];
    try {
      if (action === 'publish') {
        await axios.post(`/api/admin/super/${ep}/${id}/publish`, {}, { headers });
      } else {
        const reason = window.prompt('Motif du rejet :');
        if (reason == null) return;
        await axios.post(`/api/admin/super/${ep}/${id}/reject`, { reason }, { headers });
      }
      setPending(prev => ({
        ...prev,
        [ep === 'places' ? 'places' : ep === 'events' ? 'events' : 'info']:
          prev[ep === 'places' ? 'places' : ep === 'events' ? 'events' : 'info'].filter(x => x.id !== id)
      }));
    } catch { /* silent */ }
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

      {/* Token alert */}
      {tokens?.alert_triggered && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 24, color: '#991B1B', fontSize: '0.88rem', fontWeight: 600 }}>
          ⚠️ Alerte tokens : seuil de {tokens.alert_threshold}% atteint. Pensez à renouveler votre token FlightAPI.io.
        </div>
      )}

      {/* Pending submissions */}
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
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
            <thead>
              <tr>
                <th>Type</th>
                <th>Titre</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allPending.map(item => (
                <PendingRow key={`${item._type}-${item.id}`} item={item} type={item._type} onAction={handleAction} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Hotels list */}
      <div style={{ marginTop: 24, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Hôtels enregistrés</span>
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom</th><th>Ville</th><th>Pays</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {hotels.length === 0 ? (
              <tr><td colSpan={4}><div className={styles.empty}><div className={styles.emptyText}>Aucun hôtel</div></div></td></tr>
            ) : hotels.map(h => (
              <tr key={h.id}>
                <td style={{ fontWeight: 600 }}>{h.name}</td>
                <td>{h.city || '—'}</td>
                <td>{h.country || '—'}</td>
                <td><span className={`${styles.badge} ${h.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                  {h.is_active ? 'Actif' : 'Inactif'}
                </span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
