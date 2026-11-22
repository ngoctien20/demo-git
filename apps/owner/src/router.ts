import { useEffect, useState } from 'react';

export type Route = { path: string; query: URLSearchParams };
const read = (): Route => {
  const h = location.hash.replace(/^#/, '') || '/';
  const [path, q = ''] = h.split('?');
  return { path: path || '/', query: new URLSearchParams(q) };
};
export function useRoute(): Route {
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => { setR(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}
export const go = (path: string) => { location.hash = path; };
