import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <button
      className={styles.btn}
      onClick={toggleDarkMode}
      aria-label={darkMode ? 'Passer en mode clair' : 'Passer en mode sombre'}
      title={darkMode ? 'Mode clair' : 'Mode sombre'}
    >
      {darkMode ? '☀️' : '🌙'}
    </button>
  );
}
