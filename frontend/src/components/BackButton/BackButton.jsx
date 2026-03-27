import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from './BackButton.module.css';

export default function BackButton({ to = '/', label }) {
  const navigate  = useNavigate();
  const { t }     = useLanguage();

  return (
    <button
      className={styles.btn}
      onClick={() => navigate(to, { state: { direction: 'back' } })}
      aria-label={label || t('common.back')}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span>{label || t('common.back')}</span>
    </button>
  );
}
