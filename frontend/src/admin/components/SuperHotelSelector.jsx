import React, { useEffect, useState } from 'react';
import api from '../useAdminApi';

/**
 * Sélecteur d'hôtel pour le super-admin dans la section /admin/hotel.
 * Stocke l'ID choisi dans sessionStorage ('super_hotel_id').
 * Les pages hotel/ lisent ce paramètre et l'injectent dans ?hotel_id=X.
 */
export default function SuperHotelSelector() {
  const [hotels,    setHotels]    = useState([]);
  const [selected,  setSelected]  = useState(() => sessionStorage.getItem('super_hotel_id') || '');

  useEffect(() => {
    api.get('/super/hotels').then(({ data }) => {
      const list = Array.isArray(data) ? data.filter(h => h.is_active) : [];
      setHotels(list);
      // Si aucun hôtel sélectionné, prendre le premier
      if (!selected && list.length > 0) {
        const first = String(list[0].id);
        setSelected(first);
        sessionStorage.setItem('super_hotel_id', first);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

  const handleChange = (e) => {
    setSelected(e.target.value);
    sessionStorage.setItem('super_hotel_id', e.target.value);
    // Recharger la page pour que les données se rafraîchissent
    window.location.reload();
  };

  if (hotels.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: '0.75rem', color: '#9CA3AF', fontWeight: 600 }}>Hôtel :</span>
      <select
        value={selected}
        onChange={handleChange}
        style={{
          padding: '5px 8px', borderRadius: 7, border: '1px solid #D1D5DB',
          fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem',
          background: '#fff', cursor: 'pointer', color: '#374151',
          maxWidth: 180,
        }}
      >
        {hotels.map(h => (
          <option key={h.id} value={h.id}>{h.nom}</option>
        ))}
      </select>
    </div>
  );
}

/** Hook pour lire l'hotel_id résolu (super-admin → super_hotel_id, sinon hotel_id du JWT) */
export function useSuperHotelId(user) {
  if (user?.role === 'super_admin') {
    const stored = sessionStorage.getItem('super_hotel_id');
    return stored ? parseInt(stored) : null;
  }
  return user?.hotel_id || null;
}
