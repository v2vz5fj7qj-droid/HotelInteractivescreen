// HotelAssignPicker — sélecteur d'hôtels pour l'affectation de contenu (super-admin)
// Props :
//   selectedIds : number[]          — IDs hôtels actuellement sélectionnés
//   onChange    : (ids: number[]) => void
import React, { useEffect, useState } from 'react';
import api from '../useAdminApi';
import styles from '../Admin.module.css';

export default function HotelAssignPicker({ selectedIds = [], onChange }) {
  const [hotels,  setHotels]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/super/hotels')
      .then(r => setHotels(Array.isArray(r.data) ? r.data : (r.data?.data ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(x => x !== id)
        : [...selectedIds, id]
    );
  };

  if (loading) return (
    <div style={{ fontSize: '0.8rem', color: '#9CA3AF', padding: '6px 0' }}>
      Chargement des hôtels…
    </div>
  );

  if (!hotels.length) return null;

  return (
    <div style={{
      border: '1px solid #E5E7EB', borderRadius: 8,
      padding: '10px 14px', marginTop: 12,
      background: '#FAFAFA',
    }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>
        Afficher sur les hôtels
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {hotels.map(h => {
          const checked = selectedIds.includes(h.id);
          return (
            <label key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${checked ? '#C2782A' : '#D1D5DB'}`,
              background: checked ? '#FEF3E8' : '#fff',
              color: checked ? '#92400E' : '#374151',
              fontSize: '0.82rem', fontWeight: checked ? 600 : 400,
              userSelect: 'none', transition: 'all .15s',
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(h.id)}
                style={{ display: 'none' }}
              />
              <span style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                border: `2px solid ${checked ? '#C2782A' : '#9CA3AF'}`,
                background: checked ? '#C2782A' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {checked && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              {h.nom}
            </label>
          );
        })}
      </div>
      {selectedIds.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: 6 }}>
          Aucun hôtel sélectionné — ce contenu sera global (non affiché sur les bornes).
        </div>
      )}
    </div>
  );
}
