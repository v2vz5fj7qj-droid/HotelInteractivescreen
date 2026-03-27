import React, { useState, useEffect, useCallback } from 'react';
import api    from '../useAdminApi';
import styles from '../Admin.module.css';

const EMPTY = {
  name: '', country: 'Burkina Faso',
  owm_city_id: '', lat: '', lng: '',
  timezone: 'Africa/Ouagadougou',
  is_active: true, is_default: false, display_order: 0,
};

const TIMEZONES = [
  'Africa/Ouagadougou','Africa/Abidjan','Africa/Dakar','Africa/Bamako',
  'Africa/Lagos','Africa/Nairobi','Africa/Accra','Africa/Douala',
  'Europe/Paris','America/New_York','Asia/Dubai',
];

export default function LocalitiesManager() {
  const [items,      setItems]      = useState([]);
  const [modal,      setModal]      = useState(null);
  const [editing,    setEditing]    = useState(EMPTY);
  const [saving,     setSaving]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg,        setMsg]        = useState('');

  const load = useCallback(() =>
    api.get('/localities').then(r => setItems(r.data)).catch(() => {}), []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing({ ...EMPTY }); setModal('edit'); };
  const openEdit   = item => { setEditing({ ...item, is_active: !!item.is_active, is_default: !!item.is_default }); setModal('edit'); };

  const save = async () => {
    if (!editing.name.trim()) return;
    setSaving(true);
    try {
      if (editing.id) {
        await api.put(`/localities/${editing.id}`, editing);
      } else {
        await api.post('/localities', editing);
      }
      setMsg('Localité enregistrée');
      setModal(null);
      load();
    } catch { setMsg('Erreur lors de l\'enregistrement'); }
    finally  { setSaving(false); setTimeout(() => setMsg(''), 3000); }
  };

  const remove = async id => {
    if (!window.confirm('Supprimer cette localité ?')) return;
    try {
      await api.delete(`/localities/${id}`);
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Erreur suppression');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  const setDefault = async item => {
    await api.put(`/localities/${item.id}`, { ...item, is_default: true });
    load();
  };

  const refreshWeather = async () => {
    setRefreshing(true);
    try {
      const r = await api.post('/weather/refresh');
      setMsg(`Données météo rafraîchies (${r.data.refreshed}/${r.data.total} localité(s))`);
    } catch {
      setMsg('Erreur lors du rafraîchissement');
    } finally {
      setRefreshing(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  return (
    <div className={styles.managerPage}>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>🌍 Localités météo</h1>
          <p className={styles.managerSub}>
            Villes affichées dans la section météo. La localité par défaut est utilisée sur la borne.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={styles.btnSecondary} onClick={refreshWeather} disabled={refreshing}>
            {refreshing ? '⏳ Rafraîchissement…' : '🔄 Rafraîchir météo'}
          </button>
          <button className={styles.btnPrimary} onClick={openCreate}>+ Nouvelle localité</button>
        </div>
      </div>

      {msg && <div className={styles.toast}>{msg}</div>}

      {/* Tableau */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ville</th>
              <th>Pays</th>
              <th>OWM City ID</th>
              <th>Coordonnées</th>
              <th>Fuseau</th>
              <th>Défaut</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td><strong>{item.name}</strong></td>
                <td>{item.country}</td>
                <td>
                  <code style={{ fontSize: '0.8rem' }}>{item.owm_city_id || '—'}</code>
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--c-text-muted)' }}>
                  {item.lat && item.lng ? `${item.lat}, ${item.lng}` : '—'}
                </td>
                <td style={{ fontSize: '0.8rem' }}>{item.timezone}</td>
                <td>
                  {item.is_default ? (
                    <span className={styles.badgeDefault}>★ Défaut</span>
                  ) : (
                    <button className={styles.btnLink} onClick={() => setDefault(item)}>
                      Définir défaut
                    </button>
                  )}
                </td>
                <td>
                  <span className={item.is_active ? styles.badgeActive : styles.badgeInactive}>
                    {item.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.btnEdit}   onClick={() => openEdit(item)}>✏️</button>
                    <button className={styles.btnDelete} onClick={() => remove(item.id)}
                      disabled={!!item.is_default} title={item.is_default ? 'La localité par défaut ne peut être supprimée' : ''}>
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} className={styles.emptyRow}>Aucune localité configurée</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal édition */}
      {modal === 'edit' && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editing.id ? 'Modifier la localité' : 'Nouvelle localité'}</h2>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGrid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Nom de la ville *</label>
                  <input className={styles.input} value={editing.name}
                    onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                    placeholder="ex: Ouagadougou" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Pays</label>
                  <input className={styles.input} value={editing.country}
                    onChange={e => setEditing(p => ({ ...p, country: e.target.value }))}
                    placeholder="ex: Burkina Faso" />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>OpenWeatherMap City ID</label>
                <input className={styles.input} value={editing.owm_city_id}
                  onChange={e => setEditing(p => ({ ...p, owm_city_id: e.target.value }))}
                  placeholder="ex: 2355426 (rechercher sur openweathermap.org)" />
                <span className={styles.fieldHint}>
                  Trouver l'ID : <a href="https://openweathermap.org/find" target="_blank" rel="noreferrer">openweathermap.org/find</a>
                </span>
              </div>

              <div className={styles.formGrid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Latitude</label>
                  <input className={styles.input} type="number" step="0.0001"
                    value={editing.lat}
                    onChange={e => setEditing(p => ({ ...p, lat: e.target.value }))}
                    placeholder="ex: 12.3641" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Longitude</label>
                  <input className={styles.input} type="number" step="0.0001"
                    value={editing.lng}
                    onChange={e => setEditing(p => ({ ...p, lng: e.target.value }))}
                    placeholder="ex: -1.5332" />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Fuseau horaire</label>
                <select className={styles.select} value={editing.timezone}
                  onChange={e => setEditing(p => ({ ...p, timezone: e.target.value }))}>
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>

              <div className={styles.formGrid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Ordre d'affichage</label>
                  <input className={styles.input} type="number"
                    value={editing.display_order}
                    onChange={e => setEditing(p => ({ ...p, display_order: +e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Options</label>
                  <div className={styles.toggleRow}>
                    <label className={styles.toggleLabel}>
                      <input type="checkbox" checked={!!editing.is_active}
                        onChange={e => setEditing(p => ({ ...p, is_active: e.target.checked }))} />
                      Actif
                    </label>
                    <label className={styles.toggleLabel}>
                      <input type="checkbox" checked={!!editing.is_default}
                        onChange={e => setEditing(p => ({ ...p, is_default: e.target.checked }))} />
                      Localité par défaut
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save} disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
