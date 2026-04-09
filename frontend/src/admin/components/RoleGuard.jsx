import { useAuth } from '../contexts/AuthContext';

// Masque le contenu si le rôle ne correspond pas
// Usage : <RoleGuard roles={['super_admin']}>...</RoleGuard>
export default function RoleGuard({ roles, children, fallback = null }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return fallback;
  return children;
}
