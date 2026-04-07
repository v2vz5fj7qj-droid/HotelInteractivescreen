import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import styles from './MobileGate.module.css';

const SECTION_COMPONENTS = {
  weather:  lazy(() => import('../sections/Weather/Weather')),
  flights:  lazy(() => import('../sections/Flights/Flights')),
  map:      lazy(() => import('../sections/Map/MapSection')),
  wellness: lazy(() => import('../sections/Wellness/Wellness')),
  info:     lazy(() => import('../sections/UsefulInfo/UsefulInfo')),
};

export default function MobileGate() {
  const { section }      = useParams();
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();

  const token = searchParams.get('token');
  const lang  = searchParams.get('lang') || 'fr';
  const isFr  = lang !== 'en';

  const [status,       setStatus]       = useState('loading');
  const [validSection, setValidSection] = useState(section);

  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
      return;
    }

    api.get(`/qr/validate/${token}`)
      .then(({ data }) => {
        if (data.valid) {
          setValidSection(data.section);
          setStatus('valid');
        } else {
          setStatus('expired');
        }
      })
      .catch((err) => {
        if (err.response?.status === 410) setStatus('expired');
        else setStatus('invalid');
      });
  }, [token, navigate]);

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className="spinner" />
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <span className={styles.bigIcon}>⏱</span>
          <h1 className={styles.title}>
            {isFr ? 'QR code expiré' : 'QR code expired'}
          </h1>
          <p className={styles.message}>
            {isFr
              ? 'Ce QR code n\'est plus valide. Veuillez en générer un nouveau depuis la borne.'
              : 'This QR code is no longer valid. Please generate a new one from the kiosk.'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <span className={styles.bigIcon}>⚠️</span>
          <h1 className={styles.title}>
            {isFr ? 'Lien invalide' : 'Invalid link'}
          </h1>
          <p className={styles.message}>
            {isFr
              ? 'Ce lien ne correspond à aucun QR code connu.'
              : 'This link does not match any known QR code.'}
          </p>
        </div>
      </div>
    );
  }

  // Token valide → afficher directement le composant de la section
  const SectionComponent = SECTION_COMPONENTS[validSection];

  if (!SectionComponent) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <span className={styles.bigIcon}>⚠️</span>
          <h1 className={styles.title}>
            {isFr ? 'Section introuvable' : 'Section not found'}
          </h1>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className={styles.page}><div className="spinner" /></div>}>
      <SectionComponent />
    </Suspense>
  );
}
