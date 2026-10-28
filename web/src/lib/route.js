// Định tuyến theo #hash (giống bản cũ): #/  #/tx  #/debts/<id>  #/fx …
import { useMemo, useSyncExternalStore } from 'react';

const subscribe = (fn) => { window.addEventListener('hashchange', fn); return () => window.removeEventListener('hashchange', fn); };
const getHash = () => location.hash || '';

export function parseHash(hash = getHash()) {
  const raw = (hash || '').replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [name = '', id = ''] = path.split('/');
  const params = Object.fromEntries(new URLSearchParams(query));
  if (id) params.id = decodeURIComponent(id);
  return { name: name || 'home', params };
}

export function useRoute() {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return useMemo(() => ({ ...parseHash(hash), hash }), [hash]);
}

export const hrefOf = (name, id) => `#/${name === 'home' ? '' : name}${id ? `/${encodeURIComponent(id)}` : ''}`;
export function navigate(name, id) { location.hash = hrefOf(name, id); }
