import React from 'react';
import BackButton from '../../BackButton/BackButton';
// TODO Sprint 3 — Contacts depuis /api/info
export default function UsefulInfo() {
  return (
    <div style={{ width:'100vw', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <BackButton />
      <span style={{ fontSize:'3rem' }}>📞</span>
      <p style={{ color:'var(--c-text-muted)' }}>Infos utiles — Sprint 3</p>
    </div>
  );
}
