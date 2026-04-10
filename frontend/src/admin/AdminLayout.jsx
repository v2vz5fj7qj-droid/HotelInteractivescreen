import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import NotificationBell from './components/NotificationBell';
import SuperHotelSelector from './components/SuperHotelSelector';
import styles from './Admin.module.css';

// ── Menus par section ─────────────────────────────────────────────

const NAV_SUPER = [
  { to: '/admin/super',                   icon: '📊', label: 'Tableau de bord', end: true },
  { to: '/admin/super/hotels',            icon: '🏨', label: 'Hôtels'                     },
  { to: '/admin/super/users',             icon: '👤', label: 'Utilisateurs'                },
  { to: '/admin/super/places',            icon: '🗺️', label: 'Carte & Lieux'               },
  { to: '/admin/super/events',            icon: '🗓️', label: 'Agenda'                      },
  { to: '/admin/super/info',              icon: '📞', label: 'Infos utiles'                },
  { to: '/admin/super/service-categories',icon: '🏷️', label: 'Catégories services'         },
  { to: '/admin/super/weather',           icon: '🌍', label: 'Météo'                       },
  { to: '/admin/super/airports',          icon: '✈️', label: 'Aéroports'                   },
  { to: '/admin/super/tokens',            icon: '🔑', label: 'Tokens API'                  },
  { to: '/admin/super/audit-log',        icon: '📋', label: 'Journal d\'activité'           },
];

const NAV_HOTEL = [
  { to: '/admin/hotel',               icon: '📊', label: 'Tableau de bord', end: true },
  { to: '/admin/hotel/settings',      icon: '⚙️', label: 'Paramètres hôtel'            },
  { to: '/admin/hotel/services',      icon: '💆', label: 'Services & bien-être'         },
  { to: '/admin/hotel/tips',          icon: '💡', label: 'Bon à savoir'                 },
  { to: '/admin/hotel/events',        icon: '🗓️', label: 'Agenda'                      },
  { to: '/admin/hotel/notifications', icon: '🔔', label: 'Notifications borne'          },
];

const NAV_CONTRIBUTOR = [
  { to: '/admin/contributor',         icon: '📊', label: 'Mes soumissions', end: true },
  { to: '/admin/contributor/places',  icon: '🗺️', label: 'Mes lieux'                  },
  { to: '/admin/contributor/events',  icon: '🗓️', label: 'Mes événements'             },
  { to: '/admin/contributor/info',    icon: '📞', label: 'Mes infos utiles'            },
];

const ROLE_LABELS = {
  super_admin:  { label: 'Super Admin',   color: '#8B5CF6' },
  hotel_admin:  { label: 'Admin Hôtel',   color: '#C2782A' },
  hotel_staff:  { label: 'Staff',         color: '#3B82F6' },
  contributor:  { label: 'Contributeur',  color: '#10B981' },
};

function navBySection(section) {
  if (section === 'super')       return NAV_SUPER;
  if (section === 'hotel')       return NAV_HOTEL;
  if (section === 'contributor') return NAV_CONTRIBUTOR;
  return [];
}

function usePageTitle(nav) {
  const { pathname } = useLocation();
  const match = nav.find(n => n.end ? pathname === n.to : pathname.startsWith(n.to));
  return match ? match.label : 'Backoffice';
}

// ── Layout ───────────────────────────────────────────────────────

export default function AdminLayout({ section }) {
  const navigate               = useNavigate();
  const { user, logout }       = useAuth();
  const [collapsed, setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav       = navBySection(section);
  const pageTitle = usePageTitle(nav);
  const roleInfo  = ROLE_LABELS[user?.role] || { label: user?.role, color: '#6B7280' };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  // Lien "Voir la borne" — super-admin peut naviguer entre sections
  const switchLinks = user?.role === 'super_admin' ? (
    <div style={{ display: 'flex', gap: 8 }}>
      {section !== 'hotel' && (
        <button className={styles.btnLink} onClick={() => navigate('/admin/hotel')} style={{ fontSize: '0.78rem' }}>
          Vue hôtel
        </button>
      )}
      {section !== 'super' && (
        <button className={styles.btnLink} onClick={() => navigate('/admin/super')} style={{ fontSize: '0.78rem' }}>
          Super-admin
        </button>
      )}
    </div>
  ) : null;

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}>
      <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarLogo}>🏨</span>
          {!collapsed && <span className={styles.sidebarTitle}>ConnectBé</span>}
        </div>

        {/* Badge rôle */}
        {!collapsed && (
          <div style={{ padding: '8px 16px 0' }}>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
              fontSize: '0.7rem', fontWeight: 700,
              background: roleInfo.color + '22', color: roleInfo.color,
              border: `1px solid ${roleInfo.color}55`,
            }}>
              {roleInfo.label}
            </span>
            <div style={{ fontSize: '0.72rem', color: 'rgba(245,230,200,0.4)', marginTop: 4, paddingLeft: 2 }}>
              {user?.email}
            </div>
          </div>
        )}

        <nav className={styles.sidebarNav} style={{ marginTop: 12 }}>
          {nav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {(!collapsed || mobileOpen) && <span className={styles.navLabel}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Déplier' : 'Replier'}>
            {collapsed ? '→' : '←'}
          </button>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            {(collapsed && !mobileOpen) ? '🚪' : '🚪 Déconnexion'}
          </button>
        </div>
      </aside>

      {/* ── Contenu ── */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={styles.hamburgerBtn}
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Menu"
            >
              ☰
            </button>
            <span style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>ConnectBé</span>
            <span style={{ color: '#D1D5DB' }}>›</span>
            <span className={styles.topbarPath}>{pageTitle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {switchLinks}
            {section === 'hotel' && user?.role === 'super_admin' && <SuperHotelSelector />}
            <NotificationBell />
            <a href="/" target="_blank" rel="noreferrer" className={styles.previewLink}>
              👁 Voir la borne
            </a>
          </div>
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
