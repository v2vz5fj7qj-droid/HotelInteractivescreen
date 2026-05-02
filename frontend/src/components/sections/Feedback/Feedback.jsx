import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useHotel }    from '../../../contexts/HotelContext';
import { trackEvent }  from '../../../services/analytics';
import api             from '../../../services/api';
import BackButton      from '../../BackButton/BackButton';
import styles          from './Feedback.module.css';

const CATEGORIES = [
  { key: 'proprete',     emoji: '✨', labelKey: 'feedback.category_proprete'    },
  { key: 'accueil',      emoji: '🤝', labelKey: 'feedback.category_accueil'     },
  { key: 'chambre',      emoji: '🛏️', labelKey: 'feedback.category_chambre'     },
  { key: 'restauration', emoji: '🍽️', labelKey: 'feedback.category_restauration'},
  { key: 'services',     emoji: '🏊', labelKey: 'feedback.category_services'    },
];

const QUICK_EMOJIS = ['😊', '👍', '❤️', '🌟', '👏', '😍', '🙏', '💯'];

const IDLE_TIMEOUT = 30_000;

// ── Étape 0 : Écran d'accueil ──────────────────────────────────────
function WelcomeStep({ onStart, t }) {
  return (
    <div className={styles.welcomeWrap}>
      <div className={styles.welcomeIcon}>⭐</div>
      <h1 className={styles.welcomeTitle}>{t('feedback.welcome_title')}</h1>
      <p className={styles.welcomeSub}>{t('feedback.welcome_sub')}</p>
      <button className={styles.btnPrimary} onClick={onStart}>
        {t('feedback.start')}
      </button>
    </div>
  );
}

// ── Étape 1 : Notation par catégorie ──────────────────────────────
function RatingStep({ ratings, onChange, t, onNext, onBack }) {
  const hasAnyRating = CATEGORIES.some(c => ratings[c.key] > 0);

  return (
    <div className={styles.stepWrap}>
      <h2 className={styles.stepTitle}>{t('feedback.step_rating')}</h2>
      <p className={styles.stepSub}>{t('feedback.step_rating_sub')}</p>
      <div className={styles.categoriesList}>
        {CATEGORIES.map(cat => (
          <CategoryRow
            key={cat.key}
            cat={cat}
            value={ratings[cat.key] || 0}
            onChange={v => onChange(cat.key, v)}
            label={t(cat.labelKey)}
          />
        ))}
      </div>
      <div className={styles.navRow}>
        <button className={styles.btnSecondary} onClick={onBack}>{t('common.back')}</button>
        <button
          className={styles.btnPrimary}
          onClick={onNext}
          disabled={!hasAnyRating}
        >
          {t('feedback.next')}
        </button>
      </div>
    </div>
  );
}

function CategoryRow({ cat, value, onChange, label }) {
  return (
    <div className={styles.catRow}>
      <span className={styles.catEmoji}>{cat.emoji}</span>
      <span className={styles.catLabel}>{label}</span>
      <div className={styles.stars} role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            className={`${styles.star} ${n <= value ? styles.starFilled : ''}`}
            onClick={() => onChange(n)}
            aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
            aria-pressed={n <= value}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Étape 2 : Commentaire ─────────────────────────────────────────
function CommentStep({ comment, onChange, t, onSubmit, onBack, submitting }) {
  const MAX = 200;
  const remaining = MAX - comment.length;

  const insertEmoji = e => {
    if (comment.length < MAX) onChange(comment + e);
  };

  return (
    <div className={styles.stepWrap}>
      <h2 className={styles.stepTitle}>{t('feedback.step_comment')}</h2>
      <p className={styles.stepSub}>{t('feedback.comment_optional')}</p>

      <div className={styles.emojiRow}>
        {QUICK_EMOJIS.map(e => (
          <button key={e} className={styles.emojiBtn} onClick={() => insertEmoji(e)}>
            {e}
          </button>
        ))}
      </div>

      <textarea
        className={styles.textarea}
        value={comment}
        onChange={ev => onChange(ev.target.value.slice(0, MAX))}
        placeholder={t('feedback.comment_placeholder')}
        rows={4}
        maxLength={MAX}
      />
      <p className={`${styles.charCount} ${remaining <= 20 ? styles.charCountWarn : ''}`}>
        {remaining} {t('feedback.chars_remaining')}
      </p>

      <div className={styles.navRow}>
        <button className={styles.btnSecondary} onClick={onBack} disabled={submitting}>
          {t('common.back')}
        </button>
        <button className={styles.btnGhost} onClick={onSubmit} disabled={submitting}>
          {t('feedback.skip_comment')}
        </button>
        <button className={styles.btnPrimary} onClick={onSubmit} disabled={submitting}>
          {submitting ? '…' : t('feedback.submit')}
        </button>
      </div>
    </div>
  );
}

// ── Étape 3 : Merci (soumission fraîche) ─────────────────────────
function ThankYouStep({ t, noteGlobale, onHome }) {
  const [countdown, setCountdown] = useState(8);
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => {
      if (c <= 1) { clearInterval(id); onHome(); return 0; }
      return c - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [onHome]);

  const pct   = (countdown / 8) * 100;
  const stars = noteGlobale ? Math.round(noteGlobale) : 0;

  return (
    <div className={styles.thanksWrap}>
      <div className={styles.thanksEmoji}>🙏</div>
      <h1 className={styles.thanksTitle}>{t('feedback.thanks_title')}</h1>
      <p className={styles.thanksSub}>{t('feedback.thanks_sub')}</p>
      {noteGlobale && (
        <div className={styles.thanksScore}>
          <span className={styles.thanksScoreNum}>{noteGlobale.toFixed(1)}</span>
          <span className={styles.thanksScoreStars}>
            {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
          </span>
        </div>
      )}
      <button className={styles.btnPrimary} onClick={onHome}>{t('feedback.back_home')}</button>
      <div className={styles.countdownBar}>
        <div className={styles.countdownFill} style={{ width: `${pct}%` }} />
      </div>
      <p className={styles.countdownLabel}>{t('feedback.redirect_in', { n: countdown })}</p>
    </div>
  );
}

// ── Écran "déjà soumis" (cooldown actif) ─────────────────────────
function AlreadyDoneStep({ t, onHome }) {
  return (
    <div className={styles.thanksWrap}>
      <div className={styles.thanksEmoji}>😊</div>
      <h1 className={styles.thanksTitle}>{t('feedback.already_submitted_title')}</h1>
      <p className={styles.thanksSub}>{t('feedback.already_submitted')}</p>
      <button className={styles.btnPrimary} onClick={onHome}>{t('feedback.back_home')}</button>
    </div>
  );
}

const STORAGE_KEY  = 'feedback_submitted';
const COOLDOWN_MS  = 1 * 60 * 1000; // 1 min avant de pouvoir re-soumettre

function isInCooldown() {
  const ts = sessionStorage.getItem(STORAGE_KEY);
  if (!ts) return false;
  return (Date.now() - parseInt(ts, 10)) < COOLDOWN_MS;
}

// ── Composant principal ───────────────────────────────────────────
export default function Feedback() {
  const { t, locale }  = useLanguage();
  const { hotel }      = useHotel();
  const { hotelSlug }  = useParams();
  const navigate       = useNavigate();

  // Capturé une seule fois au montage — ne change pas lors des re-renders
  const [alreadyDone] = useState(() => isInCooldown());

  const [step,        setStep]       = useState(alreadyDone ? 3 : 0);
  const [ratings,    setRatings]    = useState({});
  const [comment,    setComment]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');
  const [noteGlobale, setNoteGlobale] = useState(null);

  const idleTimer = useRef(null);

  const goHome = useCallback(() => navigate(`/${hotelSlug}`), [navigate, hotelSlug]);

  // Idle timeout : retour accueil si inactif >30s
  const resetIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(goHome, IDLE_TIMEOUT);
  }, [goHome]);

  useEffect(() => {
    resetIdle();
    window.addEventListener('pointerdown', resetIdle);
    window.addEventListener('keydown', resetIdle);
    return () => {
      clearTimeout(idleTimer.current);
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    };
  }, [resetIdle]);

  useEffect(() => { trackEvent('feedback', 'open'); }, []);

  const changeRating = (key, val) => {
    setRatings(prev => ({ ...prev, [key]: val }));
    resetIdle();
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/feedback', {
        hotel_id:   hotel?.id,
        categories: ratings,
        commentaire: comment.trim() || null,
        locale,
      });
      setNoteGlobale(res.data.note_globale);
      sessionStorage.setItem(STORAGE_KEY, Date.now());
      trackEvent('feedback', 'submit', { note: res.data.note_globale });
      setStep(3);
    } catch (err) {
      const msg = err.response?.data?.error;
      if (msg === 'already_submitted') {
        setError(t('feedback.already_submitted'));
      } else {
        setError(t('feedback.error'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.shell} onPointerDown={resetIdle}>
      {step < 3 && (
        <div className={styles.header}>
          <BackButton />
          <div className={styles.progress}>
            {[1, 2].map(s => (
              <div
                key={s}
                className={`${styles.progressDot} ${step >= s ? styles.progressDotActive : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          {error}
          <button className={styles.errorDismiss} onClick={() => setError('')}>✕</button>
        </div>
      )}

      <div className={styles.body}>
        {step === 0 && <WelcomeStep t={t} onStart={() => setStep(1)} />}
        {step === 1 && (
          <RatingStep
            ratings={ratings}
            onChange={changeRating}
            t={t}
            onNext={() => setStep(2)}
            onBack={goHome}
          />
        )}
        {step === 2 && (
          <CommentStep
            comment={comment}
            onChange={v => { setComment(v); resetIdle(); }}
            t={t}
            onSubmit={submit}
            onBack={() => setStep(1)}
            submitting={submitting}
          />
        )}
        {step === 3 && !alreadyDone && (
          <ThankYouStep t={t} noteGlobale={noteGlobale} onHome={goHome} />
        )}
        {alreadyDone && (
          <AlreadyDoneStep t={t} onHome={goHome} />
        )}
      </div>
    </div>
  );
}
