import React from 'react';
import { useLocation } from 'react-router-dom';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage }     from '../contexts/LanguageContext';
import AttractScreen       from './AttractScreen/AttractScreen';
import FullscreenManager   from './FullscreenManager/FullscreenManager';
import styles from './KioskLayout.module.css';

export default function KioskLayout({ children }) {
  const isOnline      = useOnlineStatus();
  const { t }         = useLanguage();
  const location      = useLocation();

  return (
    <div className={styles.layout}>
      {/* Écran d'attraction — toujours monté, géré par useLocation en interne */}
      <AttractScreen />

      {/* Gestionnaire plein écran */}
      <FullscreenManager />

      {/* Bannière offline */}
      {!isOnline && (
        <div className={styles.offlineBanner} role="status">
          <span>⚡</span>
          {t('common.offline_banner')}
        </div>
      )}
      {/* key = pathname force le remontage et retrigger l'animation CSS */}
      <main
        key={location.pathname}
        className={`${styles.main} ${location.state?.direction === 'back' ? 'page-enter-back' : 'page-enter'}`}
      >
        {children}
      </main>
    </div>
  );
}
