import { createContext, useContext, useState, useEffect } from 'react';
import client from '../useAdminApi';

const AuthContext = createContext(null);

// Clés sessionStorage — métadonnées non-sensibles uniquement (jamais de token)
const SK = {
  role:       'admin_role',
  hotel_id:   'admin_hotel_id',
  hotel_slug: 'admin_hotel_slug',
  email:      'admin_email',
};

export function AuthProvider({ children }) {
  // user : { role, hotel_id, hotel_slug, email } — le token JWT est dans le cookie HttpOnly
  const [user,     setUser]     = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const role       = sessionStorage.getItem(SK.role);
    const hotel_id   = sessionStorage.getItem(SK.hotel_id);
    const hotel_slug = sessionStorage.getItem(SK.hotel_slug);
    const email      = sessionStorage.getItem(SK.email);
    if (role) {
      setUser({ role, hotel_id: hotel_id ? Number(hotel_id) : null, hotel_slug: hotel_slug || null, email });
    }
    setHydrated(true);
  }, []);

  const login = (data) => {
    // data = { role, hotel_id, hotel_slug, email } — pas de token, il est dans le cookie HttpOnly
    sessionStorage.setItem(SK.role,       data.role);
    sessionStorage.setItem(SK.hotel_id,   data.hotel_id ?? '');
    sessionStorage.setItem(SK.hotel_slug, data.hotel_slug ?? '');
    sessionStorage.setItem(SK.email,      data.email);
    setUser({ role: data.role, hotel_id: data.hotel_id ?? null, hotel_slug: data.hotel_slug ?? null, email: data.email });
  };

  const logout = async () => {
    try { await client.post('/logout'); } catch { /* cookie expiré ou réseau indisponible */ }
    Object.values(SK).forEach(k => sessionStorage.removeItem(k));
    setUser(null);
  };

  const isSuperAdmin  = () => user?.role === 'super_admin';
  const isHotelAdmin  = () => user?.role === 'hotel_admin';
  const isHotelStaff  = () => user?.role === 'hotel_staff';
  const isContributor = () => user?.role === 'contributor';

  return (
    <AuthContext.Provider value={{ user, hydrated, login, logout, isSuperAdmin, isHotelAdmin, isHotelStaff, isContributor }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
