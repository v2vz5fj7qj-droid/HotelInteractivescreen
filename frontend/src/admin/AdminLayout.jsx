import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import styles from './Admin.module.css';

const NAV = [
  { to: '/admin',              icon: '📊', label: 'Tableau de bord', end: true },
  { to: '/admin/wellness',     icon: '💆', label: 'Bien-être'                  },
  { to: '/admin/events',       icon: '🗓️', label: 'Agenda'                     },
  { to: '/admin/notifications',icon: '🔔', label: 'Bon à savoir'               },
  { to: '/admin/map',          icon: '🗺️', label: 'Carte & POI'                },
  { to: '/admin/info',         icon: '📞', label: 'Infos utiles'               },
  { to: '/admin/localities',   icon: '🌍', label: 'Localités météo'            },
  { to: '/admin/flights',      icon: '✈️', label: 'Vols'                        },
  { to: '/admin/theme',        icon: '🎨', label: 'Thème'                      },
];

function usePageTitle() {
  const { pathname } = useLocation();
  const match = NAV.find(n => n.end ? pathname === n.to : pathname.startsWith(n.to));
  return match ? match.label : 'Backoffice';
}

export default function AdminLayout() {
  const navigate   = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const pageTitle  = usePageTitle();

  const logout = () => {
    sessionStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarLogo}>🏨</span>
          {!collapsed && <span className={styles.sidebarTitle}>ConnectBé</span>}
        </div>

        <nav className={styles.sidebarNav}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Déplier' : 'Replier'}>
            {collapsed ? '→' : '←'}
          </button>
          <button className={styles.logoutBtn} onClick={logout}>
            {collapsed ? '🚪' : '🚪 Déconnexion'}
          </button>
        </div>
      </aside>

      {/* ── Contenu ── */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>ConnectBé Admin</span>
            <span style={{ color: '#D1D5DB' }}>›</span>
            <span className={styles.topbarPath}>{pageTitle}</span>
          </div>
          <a href="/" target="_blank" rel="noreferrer" className={styles.previewLink}>
            👁 Voir la borne
          </a>
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
