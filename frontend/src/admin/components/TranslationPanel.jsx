import React from 'react';
import localesMeta from '../../i18n/locales.json';

/**
 * Barre de traduction automatique à placer au-dessus des onglets de langues.
 *
 * Props :
 *   sourceLang      — locale actuellement sélectionnée comme source de rédaction
 *   onSourceChange  — callback(locale) quand l'admin change la langue source
 *   allLocales      — tableau de toutes les locales, ex. ['fr','en','de',...]
 *   onTranslateAll  — callback() déclenché par le bouton "Tout traduire"
 *   translating     — booléen, true pendant le traitement
 */
export default function TranslationPanel({
  sourceLang,
  onSourceChange,
  allLocales,
  onTranslateAll,
  translating,
}) {
  const targetCount = allLocales.length - 1;

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            12,
      padding:        '10px 14px',
      background:     '#FDF6EC',
      borderRadius:   10,
      border:         '1px solid #E5C97E',
      marginBottom:   16,
      flexWrap:       'wrap',
    }}>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#6B4C1C', whiteSpace: 'nowrap' }}>
        Langue de rédaction :
      </span>

      <select
        value={sourceLang}
        onChange={e => onSourceChange(e.target.value)}
        style={{
          border:       '1px solid #D4A843',
          borderRadius: 6,
          padding:      '4px 8px',
          fontSize:     '0.82rem',
          fontWeight:   600,
          background:   '#fff',
          cursor:       'pointer',
          color:        '#2C1A06',
        }}
      >
        {allLocales.map(l => (
          <option key={l} value={l}>
            {localesMeta[l]?.flag} {localesMeta[l]?.nativeName}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onTranslateAll}
        disabled={translating}
        style={{
          marginLeft:   'auto',
          padding:      '6px 16px',
          borderRadius: 8,
          border:       '1px solid #C2782A',
          background:   translating ? '#F5E6C8' : '#C2782A',
          color:        translating ? '#C2782A' : '#fff',
          fontSize:     '0.82rem',
          fontWeight:   600,
          cursor:       translating ? 'not-allowed' : 'pointer',
          whiteSpace:   'nowrap',
          transition:   'background 0.15s',
        }}
      >
        {translating
          ? '⏳ Traduction en cours…'
          : `✨ Traduire vers les ${targetCount} autres langues`}
      </button>
    </div>
  );
}
