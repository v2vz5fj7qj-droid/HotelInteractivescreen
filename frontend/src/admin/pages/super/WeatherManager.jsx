import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import styles from '../../Admin.module.css';

const TIMEZONES = [
  'Africa/Ouagadougou','Africa/Abidjan','Africa/Dakar','Africa/Bamako',
  'Africa/Lagos','Africa/Nairobi','Africa/Accra','Africa/Douala',
  'Europe/Paris','America/New_York','Asia/Dubai',
];

const EMPTY_NEW_LOC = {
  name: '', country: 'Burkina Faso', owm_city_id: '',
  lat: '', lng: '', timezone: 'Africa/Ouagadougou', is_active: true, is_default: false, display_order: 0,
};

export default function WeatherManager() {
  const [hotels,     setHotels]     = useState([]);
  const [localities, setLocalities] = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [hotelLocs,  setHotelLocs]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [addForm,    setAddForm]    = useState({ locality_id: '', is_default: false });
  const [toast,      setToast]      = useState('');
  const [newLoc,     setNewLoc]     = useState(EMPTY_NEW_LOC);
  const [creatingLoc, setCreatingLoc] = useState(false);

  const load = useCallback(async () => {
    try {
      const [{ data: h }, { data: locs }] = await Promise.all([
        api.get('/super/hotels'),
        api.get('/super/weather/localities'),
      ]);
      setHotels(Array.isArray(h) ? h.filter(x => x.is_active) : []);
      setLocalities(locs);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const selectHotel = async (hotel) => {
    setSelected(hotel);
    const { data } = await api.get(`/super/weather/hotels/${hotel.id}`);
    setHotelLocs(data);
  };

  const addLocality = async (localityId) => {
    const id = localityId ?? addForm.locality_id;
    if (!id) return;
    try {
      const { data } = await api.post(`/super/weather/hotels/${selected.id}`, {
        locality_id: parseInt(id),
        is_default: addForm.is_default,
      });
      setHotelLocs(data);
      setAddForm({ locality_id: '', is_default: false });
      showToast('Localité ajoutée');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const createAndAddLocality = async () => {
    if (!newLoc.name.trim()) return;
    setCreatingLoc(true);
    try {
      const { data: created } = await api.post('/localities', newLoc);
      // Rafraîchir la liste globale des localités
      const { data: locs } = await api.get('/super/weather/localities');
      setLocalities(locs);
      // Remettre à zéro le formulaire de création
      setNewLoc(EMPTY_NEW_LOC);
      setAddForm(f => ({ ...f, locality_id: '' }));
      // Ajouter directement la nouvelle localité à l'hôtel
      await addLocality(created.id);
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur création localité');
    } finally {
      setCreatingLoc(false);
    }
  };

  const removeLocality = async (localityId) => {
    try {
      await api.delete(`/super/weather/hotels/${selected.id}/${localityId}`);
      setHotelLocs(prev => prev.filter(l => l.locality_id !== localityId));
      showToast('Localité retirée');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const setDefault = async (localityId) => {
    try {
      await api.put(`/super/weather/hotels/${selected.id}/${localityId}/default`, {});
      setHotelLocs(prev => prev.map(l => ({ ...l, is_default: l.locality_id === localityId ? 1 : 0 })));
      showToast('Localité par défaut mise à jour');
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const refreshWeather = async (localityId) => {
    try {
      await api.post(`/super/weather/refresh/${localityId}`, {});
      showToast('Météo rafraîchie');
    } catch (err) { alert(err.response?.data?.error || 'Erreur refresh météo'); }
  };

  const assigned  = hotelLocs.map(l => l.locality_id);
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
          {hotels.length === 0 && (
            <div style={{ padding: 16, color: '#9CA3AF', fontSize: '0.85rem' }}>Aucun hôtel actif</div>
          )}
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
              {h.nom}
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
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB' }}>
                <span style={{ fontWeight: 700 }}>{selected.nom} — {hotelLocs.length}/5 localités</span>
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
                <div style={{ padding: '16px 20px', borderTop: '1px solid #E5E7EB' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                    <div className={styles.field} style={{ flex: 1 }}>
                      <label className={styles.label}>Ajouter une localité</label>
                      <select className={styles.select} value={addForm.locality_id}
                        onChange={e => setAddForm(f => ({ ...f, locality_id: e.target.value }))}>
                        <option value="">— Sélectionner —</option>
                        {available.map(l => <option key={l.id} value={l.id}>{l.name} ({l.country})</option>)}
                        <option value="__new__">+ Créer une nouvelle localité…</option>
                      </select>
                    </div>
                    {addForm.locality_id && addForm.locality_id !== '__new__' && (
                      <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer', paddingBottom: 10 }}>
                          <input type="checkbox" checked={addForm.is_default}
                            onChange={e => setAddForm(f => ({ ...f, is_default: e.target.checked }))} />
                          Défaut
                        </label>
                        <button className={styles.btnPrimary} onClick={() => addLocality()} style={{ paddingBottom: 10 }}>
                          Ajouter
                        </button>
                      </>
                    )}
                  </div>

                  {addForm.locality_id === '__new__' && (
                    <div style={{ marginTop: 14, padding: 16, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12, color: '#374151' }}>
                        Nouvelle localité
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className={styles.field}>
                          <label className={styles.label}>Nom de la ville *</label>
                          <input className={styles.input} value={newLoc.name}
                            onChange={e => setNewLoc(p => ({ ...p, name: e.target.value }))}
                            placeholder="ex: Ouagadougou" />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Pays</label>
                          <input className={styles.input} value={newLoc.country}
                            onChange={e => setNewLoc(p => ({ ...p, country: e.target.value }))}
                            placeholder="ex: Burkina Faso" />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>OWM City ID</label>
                          <input className={styles.input} value={newLoc.owm_city_id}
                            onChange={e => setNewLoc(p => ({ ...p, owm_city_id: e.target.value }))}
                            placeholder="ex: 2355426" />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Fuseau horaire</label>
                          <select className={styles.select} value={newLoc.timezone}
                            onChange={e => setNewLoc(p => ({ ...p, timezone: e.target.value }))}>
                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                          </select>
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Latitude</label>
                          <input className={styles.input} type="number" step="0.0001"
                            value={newLoc.lat}
                            onChange={e => setNewLoc(p => ({ ...p, lat: e.target.value }))}
                            placeholder="ex: 12.3641" />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Longitude</label>
                          <input className={styles.input} type="number" step="0.0001"
                            value={newLoc.lng}
                            onChange={e => setNewLoc(p => ({ ...p, lng: e.target.value }))}
                            placeholder="ex: -1.5332" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={addForm.is_default}
                            onChange={e => setAddForm(f => ({ ...f, is_default: e.target.checked }))} />
                          Définir comme défaut
                        </label>
                        <div style={{ flex: 1 }} />
                        <button className={styles.btnSecondary}
                          onClick={() => { setAddForm(f => ({ ...f, locality_id: '' })); setNewLoc(EMPTY_NEW_LOC); }}>
                          Annuler
                        </button>
                        <button className={styles.btnPrimary}
                          onClick={createAndAddLocality}
                          disabled={!newLoc.name.trim() || creatingLoc}>
                          {creatingLoc ? 'Création…' : 'Créer et ajouter'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
