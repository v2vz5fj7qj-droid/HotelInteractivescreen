import axios from 'axios';

// withCredentials : le navigateur envoie automatiquement le cookie HttpOnly admin_token
const client = axios.create({ baseURL: '/api/admin', withCredentials: true });

client.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      // Nettoyer les métadonnées et rediriger vers le login
      ['admin_role', 'admin_hotel_id', 'admin_hotel_slug', 'admin_email']
        .forEach(k => sessionStorage.removeItem(k));
      window.location.href = '/admin/login';
    }
    return Promise.reject(err);
  }
);

export default client;
