import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import LinkModal from '../components/LinkModal/LinkModal';

const LinkModalContext = createContext(null);

export function useLinkModal() {
  const ctx = useContext(LinkModalContext);
  if (!ctx) throw new Error('useLinkModal doit être utilisé dans un LinkModalProvider');
  return ctx;
}

// Un lien externe (http/https/protocole-relatif) doit s'ouvrir en modale.
// Les liens internes (chemins relatifs du routeur) et les protocoles natifs
// (tel:, mailto:, sms:) sont laissés intacts — impossibles/inutiles à "modaliser".
function getModalUrl(anchor) {
  if (!anchor || anchor.hasAttribute('download') || anchor.dataset.noModal !== undefined) return null;
  const rawHref = anchor.getAttribute('href') || '';
  if (!/^(https?:)?\/\//i.test(rawHref)) return null;
  return anchor.href;
}

export function LinkModalProvider({ children }) {
  const [activeUrl, setActiveUrl] = useState(null);

  const openLink = useCallback((url) => setActiveUrl(url), []);
  const closeLink = useCallback(() => setActiveUrl(null), []);

  // Intercepte tous les clics sur des liens externes, où qu'ils soient dans
  // l'arbre (y compris le contrôle d'attribution Leaflet injecté hors React),
  // pour qu'aucun lien ne fasse jamais quitter l'application kiosque.
  useEffect(() => {
    function handleClick(e) {
      if (e.defaultPrevented || e.button !== 0) return;
      const anchor = e.target.closest && e.target.closest('a[href]');
      const url = getModalUrl(anchor);
      if (!url) return;
      e.preventDefault();
      openLink(url);
    }
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [openLink]);

  return (
    <LinkModalContext.Provider value={{ openLink, closeLink }}>
      {children}
      {activeUrl && <LinkModal url={activeUrl} onClose={closeLink} />}
    </LinkModalContext.Provider>
  );
}
