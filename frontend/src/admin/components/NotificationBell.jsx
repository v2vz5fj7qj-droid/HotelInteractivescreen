import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../useAdminApi';
import styles from '../Admin.module.css';

export default function NotificationBell() {
  const [unread,  setUnread]  = useState(0);
  const [open,    setOpen]    = useState(false);
  const [notifs,  setNotifs]  = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/count');
      setUnread(data.unread || 0);
    } catch {} // silencieux — ne pas bloquer l'UI
  }, []);

  // Polling toutes les 30 secondes
  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [fetchCount]);

  // Fermer si clic extérieur
  useEffect(() => {
    const handleClick = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const openDropdown = async () => {
    setOpen(o => !o);
    if (!open) {
      setLoading(true);
      try {
        const { data } = await api.get('/notifications');
        setNotifs(data);
      } finally { setLoading(false); }
    }
  };

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnread(u => Math.max(0, u - 1));
    } catch {}
  };

  const markAll = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnread(0);
    } catch {}
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={openDropdown}
        style={{
          position: 'relative', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: '1.2rem', padding: '4px 6px',
          color: '#6B7280', lineHeight: 1,
        }}
        title="Notifications"
        aria-label={`Notifications (${unread} non lues)`}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#EF4444', color: '#fff',
            fontSize: '0.6rem', fontWeight: 800,
            borderRadius: '50%', minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, padding: '0 3px',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '110%', zIndex: 1000,
          background: '#fff', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          minWidth: 320, maxWidth: 380, maxHeight: 420, overflowY: 'auto',
          border: '1px solid #E5E7EB',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #F3F4F6',
          }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', color: '#C2782A', fontWeight: 600,
              }}>
                Tout marquer lu
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>Chargement…</div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>
              <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>🔕</div>
              Aucune notification
            </div>
          ) : notifs.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && markRead(n.id)}
              style={{
                padding: '12px 16px', borderBottom: '1px solid #F9FAFB',
                background: n.is_read ? '#fff' : '#FFF7ED',
                cursor: n.is_read ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ fontSize: '0.85rem', color: '#1F2937', lineHeight: 1.4 }}>
                {n.message_fr}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#9CA3AF', marginTop: 4 }}>
                {new Date(n.created_at).toLocaleString('fr-FR', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
                {!n.is_read && <span style={{ marginLeft: 8, color: '#C2782A', fontWeight: 700 }}>● non lue</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
