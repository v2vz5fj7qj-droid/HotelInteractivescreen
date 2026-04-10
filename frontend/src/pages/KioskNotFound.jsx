import React from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';

export default function KioskNotFound() {
  const { hotelSlug } = useParams();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100vw',
      height: '100vh',
      background: '#1A1208',
      color: '#F5E6C8',
      fontFamily: 'Poppins, sans-serif',
      gap: '20px',
      textAlign: 'center',
      padding: '40px',
    }}>
      <div style={{ fontSize: 'clamp(3rem, 8vw, 6rem)', lineHeight: 1 }}>🏨</div>
      <h1 style={{
        fontFamily: 'Playfair Display, serif',
        fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
        fontWeight: 700,
        color: '#D4A843',
        margin: 0,
      }}>
        Borne introuvable
      </h1>
      <p style={{ color: '#7A6040', fontSize: 'clamp(0.9rem, 1.5vw, 1.1rem)', maxWidth: 400, margin: 0 }}>
        {hotelSlug
          ? `Aucune borne active trouvée pour « ${hotelSlug} ».`
          : 'Cette borne n\'existe pas ou n\'est plus active.'}
      </p>
      <a href="/" style={{
        marginTop: 8,
        padding: '12px 28px',
        background: 'linear-gradient(135deg, #C2782A, #D4A843)',
        borderRadius: 10,
        color: '#1A1208',
        fontWeight: 700,
        fontSize: '0.95rem',
        textDecoration: 'none',
      }}>
        Retour à l'accueil
      </a>
    </div>
  );
}
