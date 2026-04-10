import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import Pagination from '../../components/Pagination';
import styles from '../../Admin.module.css';

const ENTITY_TYPES = [
  { value: '',                label: 'Tous les types' },
  { value: 'hotel',          label: 'Hôtels' },
  { value: 'user',           label: 'Utilisateurs' },
  { value: 'place',          label: 'Lieux' },
  { value: 'event',          label: 'Événements' },
  { value: 'useful_info',    label: 'Infos utiles' },
  { value: 'service_category', label: 'Catégories services' },
  { value: 'airport',        label: 'Aéroports' },
  { value: 'api_token',      label: 'Tokens API' },
];

const ACTION_COLORS = {
  create:        { bg: '#D1FAE5', color: '#065F46' },
  update:        { bg: '#DBEAFE', color: '#1E40AF' },
  delete:        { bg: '#FEE2E2', color: '#991B1B' },
  deactivate:    { bg: '#FEF3C7', color: '#92400E' },
  publish:       { bg: '#D1FAE5', color: '#065F46' },
  reject:        { bg: '#FEE2E2', color: '#991B1B' },
  archive:       { bg: '#F3F4F6', color: '#6B7280' },
  reset_counter: { bg: '#FEF3C7', color: '#92400E' },
  update_quota:  { bg: '#DBEAFE', color: '#1E40AF' },
};

const PER_PAGE = 25;

export default function AuditLog() {
  const [entries,     setEntries]     = useState([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState(null);

  // Filtres
  const [entityType, setEntityType] = useState('');
  const [action,     setAction]     = useState('');
  const [userId,     setUserId]     = useState('');
  const [from,       setFrom]       = useState('');
  const [to,         setTo]         = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: PER_PAGE };
      if (entityType) params.entity_type = entityType;
      if (action)     params.action      = action;
      if (userId)     params.user_id     = userId;
      if (from)       params.from        = from;
      if (to)         params.to          = to;

      const { data } = await api.get('/super/audit-log', { params });
      setEntries(data.data || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [entityType, action, userId, from, to]);

  useEffect(() => { load(1); }, [load]);

  const totalPages = Math.ceil(total / PER_PAGE);

  const handleFilter = e => {
    e.preventDefault();
    load(1);
  };

  const resetFilters = () => {
    setEntityType(''); setAction(''); setUserId(''); setFrom(''); setTo('');
  };

  const formatDate = d => d
    ? new Date(d).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    : '—';

  const actionBadge = act => {
    const style = ACTION_COLORS[act] || { bg: '#F3F4F6', color: '#6B7280' };
    return (
      <span className={styles.badge} style={{ background: style.bg, color: style.color, fontFamily: 'monospace' }}>
        {act}
      </span>
    );
  };

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Journal d'activité</h1>
          <p className={styles.managerSub}>
            Toutes les actions réalisées dans le backoffice ({total} entrées)
          </p>
        </div>
      </div>

      {/* Filtres */}
      <form onSubmit={handleFilter} style={{
        background: '#fff', borderRadius: 10, padding: 16, marginBottom: 20,
        border: '1px solid #E5E7EB', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Type d'entité</label>
          <select value={entityType} onChange={e => setEntityType(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }}>
            {ENTITY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 130 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Action</label>
          <input value={action} onChange={e => setAction(e.target.value)} placeholder="ex: create"
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 90 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>User ID</label>
          <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="ID…"
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Du</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Au</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D1D5DB', fontSize: '0.85rem' }} />
        </div>
        <button type="submit" className={styles.btnPrimary} style={{ alignSelf: 'flex-end' }}>
          Filtrer
        </button>
        <button type="button" className={styles.btnSecondary} style={{ alignSelf: 'flex-end' }}
          onClick={resetFilters}>
          Réinitialiser
        </button>
      </form>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Utilisateur</th>
              <th>Action</th>
              <th>Type</th>
              <th>ID entité</th>
              <th>Détails</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Chargement…</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>📋</div><div className={styles.emptyText}>Aucune entrée</div></div></td></tr>
            ) : entries.map(e => (
              <React.Fragment key={e.id}>
                <tr>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: '#6B7280' }}>{formatDate(e.created_at)}</td>
                  <td style={{ fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 600 }}>{e.user_email || `#${e.user_id}`}</div>
                    {e.user_role && <div style={{ color: '#9CA3AF', fontSize: '0.72rem' }}>{e.user_role}</div>}
                  </td>
                  <td>{actionBadge(e.action)}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{e.entity_type}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{e.entity_id || '—'}</td>
                  <td>
                    {(e.old_value || e.new_value) && (
                      <button
                        className={styles.btnSecondary}
                        style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                        onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                      >
                        {expanded === e.id ? 'Masquer' : 'Voir'}
                      </button>
                    )}
                  </td>
                </tr>
                {expanded === e.id && (
                  <tr>
                    <td colSpan={6} style={{ padding: '0 16px 12px', background: '#F9FAFB' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {e.old_value && (
                          <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>
                              AVANT
                            </div>
                            <pre style={{
                              background: '#FEE2E2', borderRadius: 6, padding: '8px 10px',
                              fontSize: '0.75rem', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap',
                            }}>
                              {JSON.stringify(JSON.parse(e.old_value), null, 2)}
                            </pre>
                          </div>
                        )}
                        {e.new_value && (
                          <div>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>
                              APRÈS
                            </div>
                            <pre style={{
                              background: '#D1FAE5', borderRadius: 6, padding: '8px 10px',
                              fontSize: '0.75rem', margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap',
                            }}>
                              {JSON.stringify(JSON.parse(e.new_value), null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={p => load(p)} />
    </div>
  );
}
