import React, { useState, useEffect } from 'react';
import api from '../../useAdminApi';
import styles from '../../styles/Manager.module.css';

const STATUS_LABEL = {
  online:     { text: 'En ligne',    color: '#22c55e' },
  offline:    { text: 'Hors ligne',  color: '#ef4444' },
  disabled:   { text: 'Désactivée', color: '#6b7280' },
  never_seen: { text: 'Jamais vue', color: '#f59e0b' },
};

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || STATUS_LABEL.never_seen;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
      fontSize: '0.8rem', fontWeight: 600, color: s.color,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', background: s.color,
        flexShrink: 0, boxShadow: status === 'online' ? `0 0 6px ${s.color}` : 'none',
      }} />
      {s.text}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function HotelKiosksManager() {
  const [kiosks, setKiosks]   = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/hotel/kiosks');
      setKiosks(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggle(kiosk) {
    await api.put(`/hotel/kiosks/${kiosk.id}/toggle`);
    load();
  }

  const online  = kiosks.filter(k => k.status === 'online').length;
  const offline = kiosks.filter(k => k.status === 'offline').length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Bornes kiosques</h1>
      </div>

      {/* Résumé */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{kiosks.length}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.statCard} style={{ borderColor: '#22c55e33' }}>
          <span className={styles.statValue} style={{ color: '#22c55e' }}>{online}</span>
          <span className={styles.statLabel}>En ligne</span>
        </div>
        <div className={styles.statCard} style={{ borderColor: '#ef444433' }}>
          <span className={styles.statValue} style={{ color: '#ef4444' }}>{offline}</span>
          <span className={styles.statLabel}>Hors ligne</span>
        </div>
      </div>

      {loading ? (
        <p className={styles.empty}>Chargement…</p>
      ) : kiosks.length === 0 ? (
        <p className={styles.empty}>Aucune borne enregistrée pour cet hôtel.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Label</th>
                <th>Statut</th>
                <th>Dernier heartbeat</th>
                <th>Enregistrée le</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {kiosks.map(k => (
                <tr key={k.id}>
                  <td>{k.label || <em style={{ color: '#888' }}>Sans nom — #{k.id}</em>}</td>
                  <td><StatusBadge status={k.status} /></td>
                  <td style={{ fontSize: '0.8rem', color: '#aaa' }}>{formatDate(k.last_seen_at)}</td>
                  <td style={{ fontSize: '0.8rem', color: '#aaa' }}>{formatDate(k.registered_at)}</td>
                  <td>
                    <button
                      className={k.is_enabled ? styles.btnWarning : styles.btnSuccess}
                      onClick={() => handleToggle(k)}
                    >
                      {k.is_enabled ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
