import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import NotificationBell from './components/NotificationBell';
import SuperHotelSelector, { useHotelSlug } from './components/SuperHotelSelector';
import styles from './Admin.module.css';

// ── Menus par section ─────────────────────────────────────────────

const NAV_SUPER = [
  { to: '/admin/super',                    icon: '📊', label: 'Tableau de bord', end: true },
  { to: '/admin/super/hotels',             icon: '🏨', label: 'Hôtels'                     },
  { to: '/admin/super/users',              icon: '👤', label: 'Utilisateurs'                },
  { to: '/admin/super/places',             icon: '🗺️', label: 'Carte & Lieux'              },
  { to: '/admin/super/events',             icon: '🗓️', label: 'Agenda'                     },
  { to: '/admin/super/info',               icon: '📞', label: 'Infos utiles'               },
  {
    group: 'categories', icon: '🏷️', label: 'Catégories',
    children: [
      { to: '/admin/super/poi-categories',     icon: '📍', label: 'Lieux'        },
      { to: '/admin/super/event-categories',   icon: '🗓️', label: 'Agenda'       },
      { to: '/admin/super/info-categories',    icon: '🔖', label: 'Infos utiles' },
      { to: '/admin/super/service-categories', icon: '💆', label: 'Services'     },
    ],
  },
  { to: '/admin/super/weather',            icon: '🌍', label: 'Météo'                      },
  { to: '/admin/super/airports',           icon: '✈️', label: 'Aéroports'                  },
  { to: '/admin/super/tokens',             icon: '🔑', label: 'Tokens API'                 },
  { to: '/admin/super/audit-log',          icon: '📋', label: "Journal d'activité"          },
];

const NAV_HOTEL = [
  { to: '/admin/hotel',               icon: '📊', label: 'Tableau de bord', end: true },
  { to: '/admin/hotel/settings',      icon: '⚙️', label: 'Paramètres hôtel'            },
  { to: '/admin/hotel/services',      icon: '💆', label: 'Services & bien-être'         },
  { to: '/admin/hotel/tips',          icon: '💡', label: 'Bon à savoir'                 },
  { to: '/admin/hotel/events',        icon: '🗓️', label: 'Agenda'                      },
  { to: '/admin/hotel/notifications', icon: '🔔', label: 'Notifications borne'          },
  { to: '/admin/hotel/feedbacks',     icon: '⭐', label: 'Évaluations clients'           },
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

function flatItems(nav) {
  return nav.flatMap(n => n.children ? n.children : [n]);
}

function usePageTitle(nav) {
  const { pathname } = useLocation();
  const all = flatItems(nav);
  const match = all.find(n => n.end ? pathname === n.to : pathname.startsWith(n.to));
  return match ? match.label : 'Backoffice';
}

function useOpenGroups(nav) {
  const { pathname } = useLocation();
  const initial = {};
  nav.forEach(n => {
    if (n.group) {
      initial[n.group] = n.children.some(c => pathname.startsWith(c.to));
    }
  });
  return useState(initial);
}

// ── Layout ───────────────────────────────────────────────────────

export default function AdminLayout({ section }) {
  const navigate               = useNavigate();
  const { user, logout }       = useAuth();
  const [collapsed, setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav        = navBySection(section);
  const pageTitle  = usePageTitle(nav);
  const roleInfo   = ROLE_LABELS[user?.role] || { label: user?.role, color: '#6B7280' };
  const hotelSlug  = useHotelSlug(user);
  const borneHref  = hotelSlug ? `/${hotelSlug}` : null;
  const [openGroups, setOpenGroups] = useOpenGroups(nav);

  const toggleGroup = group =>
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));

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
          {nav.map(item => {
            if (item.children) {
              const isOpen = openGroups[item.group];
              const hasActive = item.children.some(c => window.location.pathname.startsWith(c.to));
              return (
                <React.Fragment key={item.group}>
                  <button
                    onClick={() => toggleGroup(item.group)}
                    className={styles.navItem}
                    style={{
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', display: 'flex', alignItems: 'center',
                      color: hasActive ? 'var(--a-primary, #C2782A)' : undefined,
                    }}
                  >
                    <span className={styles.navIcon}>{item.icon}</span>
                    {(!collapsed || mobileOpen) && (
                      <>
                        <span className={styles.navLabel} style={{ flex: 1 }}>{item.label}</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.6, marginRight: 4 }}>
                          {isOpen ? '▲' : '▼'}
                        </span>
                      </>
                    )}
                  </button>
                  {(isOpen || hasActive) && (!collapsed || mobileOpen) && (
                    <div style={{ borderLeft: '2px solid rgba(194,120,42,0.3)', marginLeft: 20, marginBottom: 2 }}>
                      {item.children.map(child => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                          }
                          style={{ paddingLeft: 12, fontSize: '0.88rem' }}
                        >
                          <span className={styles.navIcon} style={{ fontSize: '0.85rem' }}>{child.icon}</span>
                          <span className={styles.navLabel}>{child.label}</span>
                        </NavLink>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              );
            }
            return (
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
            );
          })}
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
            {borneHref && (
              <a href={borneHref} target="_blank" rel="noreferrer" className={styles.previewLink}>
                👁 Voir la borne
              </a>
            )}
          </div>
        </header>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
