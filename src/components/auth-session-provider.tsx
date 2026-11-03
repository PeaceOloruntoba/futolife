"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/browser";

type AuthState = { status: "loading" | "signed-in" | "signed-out"; userId: string | null };
const AuthSessionContext = createContext<AuthState>({ status: "loading", userId: null });

export function useAuthSession() {
  return useContext(AuthSessionContext);
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [auth, setAuth] = useState<AuthState>({ status: "loading", userId: null });

  useEffect(() => {
    if (!supabase) {
      setAuth({ status: "signed-out", userId: null });
      return;
    }

    let alive = true;
    let authEventReceived = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      authEventReceived = true;
      if (alive) setAuth(session ? { status: "signed-in", userId: session.user.id } : { status: "signed-out", userId: null });
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (alive && !authEventReceived) setAuth(session ? { status: "signed-in", userId: session.user.id } : { status: "signed-out", userId: null });
    }).catch(() => {
      if (alive && !authEventReceived) setAuth({ status: "signed-out", userId: null });
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (auth.status === "loading") {
    return <main className="community-auth-loading" role="status" aria-live="polite"><span className="community-spinner"/><span>Restoring your session…</span></main>;
  }

  return <AuthSessionContext.Provider value={auth}>{children}</AuthSessionContext.Provider>;
}
