import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type AuthUser } from '@/api';

type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: AuthUser };

const Ctx = createContext<AuthState>({ status: 'loading' });

export function AuthProvider({ children, onSignedOut }: { children: ReactNode; onSignedOut: () => void }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    api()
      .getUser()
      .then((u) => alive && setState(u ? { status: 'signedIn', user: u } : { status: 'signedOut' }));
    const off = api().onAuthChange((u) => {
      if (!alive) return;
      setState((prev) => {
        if (!u) {
          if (prev.status === 'signedIn') onSignedOut();
          return { status: 'signedOut' };
        }
        return prev.status === 'signedIn' && prev.user.id === u.id ? prev : { status: 'signedIn', user: u };
      });
    });
    return () => {
      alive = false;
      off();
    };
  }, [onSignedOut]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
