import { useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useIdle } from '../../hooks/useIdle';
import { useTheme } from '../../contexts/ThemeContext';

export default function IdleTimer() {
  const navigate      = useNavigate();
  const location      = useLocation();
  const { hotelSlug } = useParams();
  const { config }    = useTheme();
  const timeoutMs     = parseInt(config.idle_timeout_ms || '60000', 10);
  const kioskHome     = `/${hotelSlug}`;

  useIdle(timeoutMs, () => {
    if (location.pathname !== kioskHome) navigate(kioskHome);
  });

  return null;
}
