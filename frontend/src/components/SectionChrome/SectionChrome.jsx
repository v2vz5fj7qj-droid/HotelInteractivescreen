import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage }  from '../../contexts/LanguageContext';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../ThemeToggle/ThemeToggle';
import WeatherBadge     from '../WeatherBadge/WeatherBadge';
import styles           from './SectionChrome.module.css';

/**
 * Barre de navigation commune à toutes les sections.
 *
 * Elle remplace les anciens boutons flottants (retour, langue, thème, météo)
 * qui étaient positionnés en absolu par chaque page et finissaient par
 * chevaucher le contenu. Ici la barre est un vrai élément de flux
 * (sticky en haut), donc elle réserve toujours sa place.
 *
 * Props :
 *  - onBack    : surcharge du retour (vue détail, étape de formulaire…)
 *  - backTo    : route de retour explicite (défaut : accueil de l'hôtel)
 *  - backLabel : libellé du bouton retour
 *  - center    : contenu optionnel au centre (filtres, titre…)
 *  - weather   : afficher la pastille météo (défaut : oui)
 *  - theme     : afficher le bouton thème (défaut : oui)
 */
export default function SectionChrome({
  onBack,
  backTo,
  backLabel,
  center    = null,
  weather   = true,
  theme     = true,
  className = '',
}) {
  const navigate      = useNavigate();
  const { t }         = useLanguage();
  const { hotelSlug } = useParams();

  // Hors kiosque (vue mobile QR) il n'y a pas de menu où revenir
  const home      = backTo ?? (hotelSlug ? `/${hotelSlug}` : null);
  const canGoBack = Boolean(onBack || home);

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    navigate(home, { state: { direction: 'back' } });
  };

  return (
    <div className={`${styles.chrome} ${className}`}>
      <div className={styles.slotStart}>
        {canGoBack && (
          <button
            type="button"
            className={styles.back}
            onClick={handleBack}
            aria-label={backLabel || t('common.back')}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H5M5 12L12 19M5 12L12 5"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className={styles.backLabel}>{backLabel || t('common.back')}</span>
          </button>
        )}
      </div>

      <div className={styles.slotCenter}>{center}</div>

      <div className={styles.slotEnd}>
        {weather && hotelSlug && <WeatherBadge />}
        <LanguageSwitcher />
        {theme && <ThemeToggle />}
      </div>
    </div>
  );
}
