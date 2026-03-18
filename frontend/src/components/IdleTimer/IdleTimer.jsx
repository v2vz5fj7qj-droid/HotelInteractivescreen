import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useIdle } from '../../hooks/useIdle';
import { useTheme } from '../../contexts/ThemeContext';

export default function IdleTimer() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { config } = useTheme();
  const timeoutMs = parseInt(config.idle_timeout_ms || '30000', 10);

  useIdle(timeoutMs, () => {
    if (location.pathname !== '/') navigate('/');
  });

  return null;
}
