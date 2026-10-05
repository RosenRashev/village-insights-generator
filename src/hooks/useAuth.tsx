import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  is_approved: boolean;
  is_admin: boolean;
  created_at: string;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Една и съща заявка за профила не се повтаря, докато предишната още тече
  // (onAuthStateChange и getSession я предизвикват почти едновременно).
  const inflight = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  const loadProfile = (userId: string | undefined): Promise<void> => {
    if (!userId) {
      setProfile(null);
      return Promise.resolve();
    }
    if (inflight.current?.userId === userId) return inflight.current.promise;

    const promise = (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, is_approved, is_admin, created_at")
        .eq("id", userId)
        .maybeSingle();
      setProfile((data as Profile | null) ?? null);
    })().finally(() => {
      if (inflight.current?.promise === promise) inflight.current = null;
    });
    inflight.current = { userId, promise };
    return promise;
  };

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      void loadProfile(nextSession?.user?.id);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    loading,
    session,
    user: session?.user ?? null,
    profile,
    refreshProfile: async () => {
      await loadProfile(session?.user?.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth трябва да се използва вътре в AuthProvider.");
  return ctx;
}
