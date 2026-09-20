import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { setHotelId } from '../services/hotelStore';

const HotelContext = createContext(null);

// `slug` permet de monter le provider hors d'une route /:hotelSlug (cas du
// QR mobile, où le slug vient du token et non de l'URL). Sinon on lit l'URL.
export function HotelProvider({ children, slug }) {
  const { hotelSlug: slugFromRoute } = useParams();
  const hotelSlug = slug || slugFromRoute;

  const [hotel,        setHotel]        = useState(null);
  const [settings,     setSettings]     = useState(null);
  const [airports,     setAirports]     = useState([]);
  const [bannerImages, setBannerImages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!hotelSlug) return;

    setLoading(true);
    setNotFound(false);

    api.get(`/kiosk/${hotelSlug}/config`)
      .then(res => {
        const { hotel: h, settings: s, airports: a, banner_images: b } = res.data;
        setHotel(h);
        setSettings(s);
        setAirports(a || []);
        setBannerImages(b || []);
        setHotelId(h.id);   // expose au singleton pour l'intercepteur Axios
      })
      .catch(err => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));

    return () => { setHotelId(null); };
  }, [hotelSlug]);

  return (
    <HotelContext.Provider value={{ hotel, settings, airports, bannerImages, loading, notFound }}>
      {children}
    </HotelContext.Provider>
  );
}

export const useHotel = () => {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel doit être utilisé dans HotelProvider');
  return ctx;
};
