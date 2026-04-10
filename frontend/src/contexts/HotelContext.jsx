import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { setHotelId } from '../services/hotelStore';

const HotelContext = createContext(null);

export function HotelProvider({ children }) {
  const { hotelSlug } = useParams();

  const [hotel,    setHotel]    = useState(null);   // { id, slug, nom }
  const [settings, setSettings] = useState(null);   // theme_colors, wifi, etc.
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!hotelSlug) return;

    setLoading(true);
    setNotFound(false);

    api.get(`/kiosk/${hotelSlug}/config`)
      .then(res => {
        const { hotel: h, settings: s } = res.data;
        setHotel(h);
        setSettings(s);
        setHotelId(h.id);   // expose au singleton pour l'intercepteur Axios
      })
      .catch(err => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));

    return () => { setHotelId(null); };
  }, [hotelSlug]);

  return (
    <HotelContext.Provider value={{ hotel, settings, loading, notFound }}>
      {children}
    </HotelContext.Provider>
  );
}

export const useHotel = () => {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel doit être utilisé dans HotelProvider');
  return ctx;
};
