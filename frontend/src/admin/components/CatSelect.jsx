import React from 'react';
import styles from '../Admin.module.css';

/**
 * Sélecteur de catégorie partagé.
 * Affiche les catégories orphelines avec un avertissement ⚠.
 */
export default function CatSelect({ value, onChange, categories, placeholder = '— Choisir —' }) {
  return (
    <select className={styles.input} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {categories.map(c => (
        <option key={c.key_name} value={c.key_name}>
          {c.label_fr}{c.is_orphan ? '  ⚠ non formalisée' : ''}
        </option>
      ))}
    </select>
  );
}
