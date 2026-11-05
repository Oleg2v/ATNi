import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/** Tiny hash router: '#/path?x=1' */
export interface Route {
  path: string;
  params: URLSearchParams;
}

function parse(): Route {
  const h = window.location.hash.replace(/^#/, '') || '/';
  const [p, q] = h.split('?');
  return { path: p.startsWith('/') ? p : `/${p}`, params: new URLSearchParams(q ?? '') };
}

const RouteContext = createContext<Route>({ path: '/', params: new URLSearchParams() });

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(() => (typeof window === 'undefined' ? { path: '/', params: new URLSearchParams() } : parse()));
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return <RouteContext.Provider value={route}>{children}</RouteContext.Provider>;
}

export function useRoute(): Route {
  return useContext(RouteContext);
}

export function navigate(path: string): void {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function href(path: string): string {
  return `#${path}`;
}

/** Link that sets aria-current when active. */
export function Link({ to, children, className, exact, ...rest }: { to: string; children: ReactNode; className?: string; exact?: boolean } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const route = useRoute();
  const active = exact ? route.path === to : route.path === to || (to !== '/' && route.path.startsWith(to + '/'));
  return (
    <a href={href(to)} className={className} aria-current={active ? 'page' : undefined} {...rest}>
      {children}
    </a>
  );
}
