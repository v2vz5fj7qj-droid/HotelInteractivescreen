import React, { useState } from 'react';
import { useNavigate }     from 'react-router-dom';
import axios               from 'axios';
import { useAuth }         from './contexts/AuthContext';
import styles              from './Admin.module.css';

export default function AdminLogin() {
  const [form,    setForm]    = useState({ email: '', password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();
  const { login }             = useAuth();

  const submit = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await axios.post('/api/admin/login', form);
      login(data); // stocke token, role, hotel_id, email

      // Redirection selon le rôle
      if (data.role === 'super_admin')  navigate('/admin/super');
      else if (data.role === 'hotel_admin' || data.role === 'hotel_staff') navigate('/admin/hotel');
      else if (data.role === 'contributor') navigate('/admin/contributor');
      else navigate('/admin');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Identifiants incorrects. Vérifiez votre email et mot de passe.');
      } else {
        setError('Impossible de joindre le serveur. Vérifiez que le backend est démarré.');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>
          <span className={styles.loginLogoIcon}>🏨</span>
          <h1 className={styles.loginTitle}>ConnectBé</h1>
          <p className={styles.loginSub}>Administration</p>
        </div>

        <form onSubmit={submit} className={styles.loginForm}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoComplete="email"
              placeholder="votre@email.com"
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Mot de passe</label>
            <input
              className={styles.input}
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className={styles.loginError}>{error}</p>}
          <button className={styles.loginBtn} type="submit" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className={styles.loginFooter}>
          Accès réservé au personnel autorisé
        </p>
      </div>
    </div>
  );
}
