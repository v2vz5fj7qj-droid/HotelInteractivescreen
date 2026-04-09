import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { token, role, hotel_id, email }

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    const role  = sessionStorage.getItem('admin_role');
    const hotel_id = sessionStorage.getItem('admin_hotel_id');
    const email = sessionStorage.getItem('admin_email');
    if (token) setUser({ token, role, hotel_id: hotel_id ? Number(hotel_id) : null, email });
  }, []);

  const login = (data) => {
    sessionStorage.setItem('admin_token',    data.token);
    sessionStorage.setItem('admin_role',     data.role);
    sessionStorage.setItem('admin_hotel_id', data.hotel_id ?? '');
    sessionStorage.setItem('admin_email',    data.email);
    setUser(data);
  };

  const logout = () => {
    sessionStorage.clear();
    setUser(null);
  };

  const isSuperAdmin   = () => user?.role === 'super_admin';
  const isHotelAdmin   = () => user?.role === 'hotel_admin';
  const isHotelStaff   = () => user?.role === 'hotel_staff';
  const isContributor  = () => user?.role === 'contributor';

  return (
    <AuthContext.Provider value={{ user, login, logout, isSuperAdmin, isHotelAdmin, isHotelStaff, isContributor }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
