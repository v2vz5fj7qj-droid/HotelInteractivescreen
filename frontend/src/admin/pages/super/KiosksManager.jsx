import React, { useState, useEffect, useCallback } from 'react';
import api from '../../useAdminApi';
import ConfirmModal from '../../components/ConfirmModal';
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

export default function KiosksManager() {
  const [kiosks, setKiosks]       = useState([]);
  const [hotels, setHotels]       = useState([]);
  const [keys, setKeys]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('kiosks'); // kiosks | keys
  const [filterHotel, setFilterHotel] = useState('');
  const [confirm, setConfirm]     = useState(null);

  // Formulaire génération de clé
  const [keyHotelId, setKeyHotelId]       = useState('');
  const [keyExpires, setKeyExpires]       = useState(72);
  const [newKey, setNewKey]               = useState(null);
  const [keyLoading, setKeyLoading]       = useState(false);
  const [copiedId, setCopiedId]           = useState(null); // id de la clé copiée (null = aucune)

  // Formulaire édition label
  const [editId, setEditId]       = useState(null);
  const [editLabel, setEditLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [kRes, hRes, kKeys] = await Promise.allSettled([
      api.get('/super/kiosks', { params: filterHotel ? { hotel_id: filterHotel } : {} }),
      api.get('/super/hotels'),
      api.get('/super/kiosks/keys', { params: filterHotel ? { hotel_id: filterHotel } : {} }),
    ]);
    if (kRes.status === 'fulfilled') {
      const d = kRes.value.data;
      setKiosks(Array.isArray(d) ? d : (d.data || []));
    }
    if (hRes.status === 'fulfilled') {
      const d = hRes.value.data;
      setHotels(Array.isArray(d) ? d : (d.data || []));
    }
    if (kKeys.status === 'fulfilled') {
      const d = kKeys.value.data;
      setKeys(Array.isArray(d) ? d : []);
    }
    setLoading(false);
  }, [filterHotel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function handleToggle(kiosk) {
    await api.put(`/super/kiosks/${kiosk.id}/toggle`);
    load();
  }

  async function handleDelete(kiosk) {
    setConfirm({
      title:   'Supprimer la borne ?',
      message: `La borne "${kiosk.label || `#${kiosk.id}`}" sera définitivement supprimée.`,
      kiosk,
    });
  }

  async function confirmDelete() {
    if (!confirm) return;
    await api.delete(`/super/kiosks/${confirm.kiosk.id}`);
    setConfirm(null);
    load();
  }

  async function handleSaveLabel(id) {
    await api.put(`/super/kiosks/${id}`, { label: editLabel });
    setEditId(null);
    load();
  }

  async function handleGenerateKey(e) {
    e.preventDefault();
    if (!keyHotelId) return;
    setKeyLoading(true);
    setNewKey(null);
    setCopiedId(null);
    try {
      const res = await api.post('/super/kiosks/keys', { hotel_id: keyHotelId, expires_hours: keyExpires });
      setNewKey(res.data.key);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    } finally {
      setKeyLoading(false);
    }
  }

  function copyToClipboard(text, id) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Bornes kiosques</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={filterHotel}
            onChange={e => setFilterHotel(e.target.value)}
            className={styles.select}
          >
            <option value="">Tous les hôtels</option>
            {hotels.map(h => <option key={h.id} value={h.id}>{h.nom}</option>)}
          </select>
          <button
            className={styles.btnPrimary}
            onClick={() => setTab(tab === 'keys' ? 'kiosks' : 'keys')}
          >
            {tab === 'kiosks' ? '🔑 Gérer les clés' : '📋 Voir les bornes'}
          </button>
        </div>
      </div>

      {tab === 'kiosks' && (
        <>
          {loading ? (
            <p className={styles.empty}>Chargement…</p>
          ) : kiosks.length === 0 ? (
            <p className={styles.empty}>Aucune borne enregistrée.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Hôtel</th>
                    <th>Statut</th>
                    <th>Dernier heartbeat</th>
                    <th>Enregistrée le</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {kiosks.map(k => (
                    <tr key={k.id}>
                      <td>
                        {editId === k.id ? (
                          <span style={{ display: 'flex', gap: '0.4rem' }}>
                            <input
                              className={styles.inlineInput}
                              value={editLabel}
                              onChange={e => setEditLabel(e.target.value)}
                              autoFocus
                            />
                            <button className={styles.btnSmall} onClick={() => handleSaveLabel(k.id)}>✓</button>
                            <button className={styles.btnSmallGhost} onClick={() => setEditId(null)}>✕</button>
                          </span>
                        ) : (
                          <span
                            className={styles.editableLabel}
                            onClick={() => { setEditId(k.id); setEditLabel(k.label || ''); }}
                            title="Cliquer pour modifier"
                          >
                            {k.label || <em style={{ color: '#888' }}>Sans nom — #{k.id}</em>}
                            <span className={styles.editIcon}>✎</span>
                          </span>
                        )}
                      </td>
                      <td>{k.hotel_nom}</td>
                      <td><StatusBadge status={k.status} /></td>
                      <td style={{ fontSize: '0.8rem', color: '#aaa' }}>{formatDate(k.last_seen_at)}</td>
                      <td style={{ fontSize: '0.8rem', color: '#aaa' }}>{formatDate(k.registered_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className={k.is_enabled ? styles.btnWarning : styles.btnSuccess}
                            onClick={() => handleToggle(k)}
                            title={k.is_enabled ? 'Désactiver' : 'Activer'}
                          >
                            {k.is_enabled ? 'Désactiver' : 'Activer'}
                          </button>
                          <button
                            className={styles.btnDanger}
                            onClick={() => handleDelete(k)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'keys' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Formulaire de génération */}
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Générer une clé d'inscription</h2>
            <form onSubmit={handleGenerateKey} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label className={styles.formGroup}>
                <span>Hôtel</span>
                <select
                  value={keyHotelId}
                  onChange={e => setKeyHotelId(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">Sélectionner…</option>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.nom}</option>)}
                </select>
              </label>
              <label className={styles.formGroup}>
                <span>Validité (heures)</span>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={keyExpires}
                  onChange={e => setKeyExpires(e.target.value)}
                  className={styles.input}
                  style={{ width: 100 }}
                />
              </label>
              <button type="submit" className={styles.btnPrimary} disabled={keyLoading}>
                {keyLoading ? 'Génération…' : 'Générer la clé'}
              </button>
            </form>

            {newKey && (
              <div className={styles.keyDisplay}>
                <span>Clé générée :</span>
                <strong className={styles.keyValue}>{newKey}</strong>
                <button
                  className={`${styles.btnCopy} ${copiedId === 'new' ? styles.copied : ''}`}
                  onClick={() => copyToClipboard(newKey, 'new')}
                >
                  {copiedId === 'new' ? '✓ Copié !' : 'Copier'}
                </button>
              </div>
            )}
          </div>

          {/* Historique des clés */}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Clé</th>
                  <th>Hôtel</th>
                  <th>Statut</th>
                  <th>Utilisée le</th>
                  <th>Expire le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k.id}>
                    <td><code style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>{k.key_value}</code></td>
                    <td>{k.hotel_nom}</td>
                    <td>
                      <span style={{
                        color: k.key_status === 'available' ? '#22c55e'
                             : k.key_status === 'used'      ? '#6b7280'
                             : '#ef4444',
                        fontWeight: 600, fontSize: '0.8rem',
                      }}>
                        {k.key_status === 'available' ? 'Disponible'
                         : k.key_status === 'used' ? 'Utilisée'
                         : 'Expirée'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#aaa' }}>{formatDate(k.used_at)}</td>
                    <td style={{ fontSize: '0.8rem', color: '#aaa' }}>{formatDate(k.expires_at)}</td>
                    <td>
                      {k.key_status === 'available' && (
                        <button
                          className={`${styles.btnCopy} ${copiedId === k.id ? styles.copied : ''}`}
                          onClick={() => copyToClipboard(k.key_value, k.id)}
                        >
                          {copiedId === k.id ? '✓ Copié !' : 'Copier'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
