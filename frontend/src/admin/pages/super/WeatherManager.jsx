import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import styles from '../../Admin.module.css';

export default function WeatherManager() {
  const { user }      = useAuth();
  const [hotels,      setHotels]      = useState([]);
  const [localities,  setLocalities]  = useState([]);
  const [selected,    setSelected]    = useState(null);  // hotel selectionné
  const [hotelLocs,   setHotelLocs]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [adding,      setAdding]      = useState(false);
  const [addForm,     setAddForm]     = useState({ locality_id: '', is_default: false });
  const [toast,       setToast]       = useState('');

  const headers = { Authorization: `Bearer ${user?.token}` };

  const load = useCallback(async () => {
    try {
      const [{ data: h }, { data: locs }] = await Promise.all([
        axios.get('/api/admin/super/hotels',            { headers }),
        axios.get('/api/admin/super/weather/localities', { headers }),
      ]);
      setHotels(h.filter(x => x.is_active));
      setLocalities(locs);
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const selectHotel = async (hotel) => {
    setSelected(hotel);
    const { data } = await axios.get(`/api/admin/super/weather/hotels/${hotel.id}`, { headers });
    setHotelLocs(data);
  };

  const addLocality = async () => {
    if (!addForm.locality_id) return;
    try {
      const { data } = await axios.post(`/api/admin/super/weather/hotels/${selected.id}`, {
        locality_id: parseInt(addForm.locality_id),
        is_default: addForm.is_default,
      }, { headers });
      setHotelLocs(data);
      setAddForm({ locality_id: '', is_default: false });
      showToast('Localité ajoutée');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const removeLocality = async (localityId) => {
    try {
      await axios.delete(`/api/admin/super/weather/hotels/${selected.id}/${localityId}`, { headers });
      setHotelLocs(prev => prev.filter(l => l.locality_id !== localityId));
      showToast('Localité retirée');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const setDefault = async (localityId) => {
    try {
      await axios.put(`/api/admin/super/weather/hotels/${selected.id}/${localityId}/default`, {}, { headers });
      setHotelLocs(prev => prev.map(l => ({ ...l, is_default: l.locality_id === localityId ? 1 : 0 })));
      showToast('Localité par défaut mise à jour');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const refreshWeather = async (localityId) => {
    try {
      await axios.post(`/api/admin/super/weather/refresh/${localityId}`, {}, { headers });
      showToast('Météo rafraîchie');
    } catch (err) { alert(err.response?.data?.error || 'Erreur refresh météo'); }
  };

  const assigned = hotelLocs.map(l => l.locality_id);
  const available = localities.filter(l => !assigned.includes(l.id));

  if (loading) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Météo</h1>
          <p className={styles.managerSub}>Localités météo par hôtel (max 5 par hôtel)</p>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
        {/* Liste hôtels */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden', alignSelf: 'start' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #E5E7EB', fontWeight: 700, fontSize: '0.9rem' }}>
            Hôtels
          </div>
          {hotels.map(h => (
            <button key={h.id}
              onClick={() => selectHotel(h)}
              style={{ display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left', border: 'none',
                background: selected?.id === h.id ? '#FEF3C7' : 'transparent',
                fontWeight: selected?.id === h.id ? 700 : 400,
                color: selected?.id === h.id ? '#92400E' : '#1E1004',
                cursor: 'pointer', fontSize: '0.88rem',
                borderBottom: '1px solid #F3F4F6',
                fontFamily: 'Poppins, sans-serif' }}>
              {h.name}
            </button>
          ))}
        </div>

        {/* Localités de l'hôtel sélectionné */}
        <div>
          {!selected ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🌍</div>
              <div className={styles.emptyText}>Sélectionnez un hôtel pour gérer ses localités météo</div>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700 }}>{selected.name} — {hotelLocs.length}/5 localités</span>
              </div>

              <table className={styles.table}>
                <thead><tr><th>Localité</th><th>Pays</th><th>Défaut</th><th>Actions</th></tr></thead>
                <tbody>
                  {hotelLocs.length === 0 ? (
                    <tr><td colSpan={4}><div className={styles.empty}><div className={styles.emptyText}>Aucune localité</div></div></td></tr>
                  ) : hotelLocs.map(l => (
                    <tr key={l.locality_id}>
                      <td style={{ fontWeight: 600 }}>{l.name}</td>
                      <td style={{ color: '#6B7280' }}>{l.country}</td>
                      <td>{l.is_default ? <span className={`${styles.badge} ${styles.badgeFeatured}`}>Défaut</span> : '—'}</td>
                      <td>
                        <div className={styles.tdActions}>
                          {!l.is_default && (
                            <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                              onClick={() => setDefault(l.locality_id)}>Défaut</button>
                          )}
                          <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => refreshWeather(l.locality_id)}>↻ Refresh</button>
                          <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => removeLocality(l.locality_id)}>Retirer</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {hotelLocs.length < 5 && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  <div className={styles.field} style={{ flex: 1 }}>
                    <label className={styles.label}>Ajouter une localité</label>
                    <select className={styles.select} value={addForm.locality_id}
                      onChange={e => setAddForm(f => ({ ...f, locality_id: e.target.value }))}>
                      <option value="">— Sélectionner —</option>
                      {available.map(l => <option key={l.id} value={l.id}>{l.name} ({l.country})</option>)}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', paddingBottom: 10 }}>
                    <input type="checkbox" checked={addForm.is_default}
                      onChange={e => setAddForm(f => ({ ...f, is_default: e.target.checked }))} />
                    Défaut
                  </label>
                  <button className={styles.btnPrimary} onClick={addLocality}
                    disabled={!addForm.locality_id} style={{ paddingBottom: 10 }}>
                    Ajouter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
