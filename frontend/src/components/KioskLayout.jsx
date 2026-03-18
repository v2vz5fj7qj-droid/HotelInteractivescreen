import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useLanguage }     from '../contexts/LanguageContext';
import styles from './KioskLayout.module.css';

export default function KioskLayout({ children }) {
  const isOnline = useOnlineStatus();
  const { t }    = useLanguage();

  return (
    <div className={styles.layout}>
      {/* Bannière offline */}
      {!isOnline && (
        <div className={styles.offlineBanner} role="status">
          <span>⚡</span>
          {t('common.offline_banner')}
        </div>
      )}
      <main className={`${styles.main} page-enter`}>
        {children}
      </main>
    </div>
  );
}
