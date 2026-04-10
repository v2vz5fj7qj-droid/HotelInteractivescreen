// Singleton module — stocke le hotel_id courant pour que l'intercepteur Axios
// puisse l'injecter sans dépendance circulaire avec HotelContext.
let _hotelId = null;

export function setHotelId(id) { _hotelId = id; }
export function getHotelId()   { return _hotelId; }
