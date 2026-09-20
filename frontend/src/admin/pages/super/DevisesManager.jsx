// Super-admin — Accès direct à la configuration du convertisseur de devises,
// hôtel par hôtel (support), sans passer par la fiche hôtel complète.
import React, { useEffect, useState } from 'react';
import api from '../../useAdminApi';
import DeviseManager from '../hotel/DeviseManager';
import styles from '../../Admin.module.css';

export default function SuperDevisesManager() {
  const [hotels,  setHotels]  = useState([]);
  const [hotelId, setHotelId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/super/hotels').then(({ data }) => {
      const list = Array.isArray(data) ? data : [];
      setHotels(list);
      if (list.length > 0) setHotelId(list[0].id);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  if (hotels.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>🏨</div>
        <div className={styles.emptyText}>Aucun hôtel enregistré</div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Devises</h1>
          <p className={styles.managerSub}>
            Configurer le convertisseur de devises pour un hôtel en particulier (support).
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6B7280' }}>Hôtel :</label>
          <select
            className={styles.select}
            value={hotelId ?? ''}
            onChange={e => setHotelId(parseInt(e.target.value, 10))}
            style={{ minWidth: 220 }}
          >
            {hotels.map(h => (
              <option key={h.id} value={h.id}>
                {h.nom}{!h.is_active ? ' (inactif)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* key={hotelId} force un remontage propre — DeviseManager charge ses données au montage */}
      <DeviseManager key={hotelId} hotelId={hotelId} />
    </div>
  );
}
