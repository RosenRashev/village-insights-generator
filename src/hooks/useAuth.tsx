import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  /** Профилът не успя да се зареди (мрежа/сървър) — различно от „няма профил“. */
  profileError: boolean;
  /** `true`, ако последният изход е по искане на потребителя (а не изтекла сесия). */
  signedOutByUser: () => boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);
  const explicitSignOut = useRef(false);
  const queryClient = useQueryClient();

  // Една и съща заявка за профила не се повтаря, докато предишната още тече
  // (onAuthStateChange и getSession я предизвикват почти едновременно).
  const inflight = useRef<{ userId: string; promise: Promise<void> } | null>(null);

  const loadProfile = (userId: string | undefined): Promise<void> => {
    if (!userId) {
      setProfile(null);
      return Promise.resolve();
    }
    if (inflight.current?.userId === userId) return inflight.current.promise;

    const fetchProfile = () =>
      supabase
        .from("profiles")
        .select("id, email, is_approved, is_admin, created_at")
        .eq("id", userId)
        .maybeSingle();

    const promise = (async () => {
      let { data, error } = await fetchProfile();
      if (error) {
        // Временна грешка (напр. при опресняване на сесията) — още един опит след секунда.
        console.warn("[auth] профилът не се зареди, нов опит:", error.message);
        await new Promise((r) => setTimeout(r, 1000));
        ({ data, error } = await fetchProfile());
      }
      if (error) {
        console.warn("[auth] профилът не се зареди:", error.message);
        setProfileError(true);
        // Не губим вече заредения профил на същия потребител заради временна грешка.
        setProfile((prev) => (prev?.id === userId ? prev : null));
        return;
      }
      setProfileError(false);
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
      if (nextSession) explicitSignOut.current = false;
      setSession(nextSession);
      void loadProfile(nextSession?.user?.id);
    });

    void supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        await loadProfile(data.session?.user?.id);
      })
      .catch((err) => console.warn("[auth] сесията не се прочете:", err))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;
  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      profileError,
      signedOutByUser: () => explicitSignOut.current,
      refreshProfile: async () => {
        await loadProfile(userId);
      },
      signOut: async () => {
        explicitSignOut.current = true;
        await supabase.auth.signOut();
        // Заредените доклади на потребителя не остават в паметта на браузъра.
        queryClient.clear();
        setProfile(null);
        setProfileError(false);
        setSession(null);
      },
    }),
    [loading, session, profile, profileError, userId, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth трябва да се използва вътре в AuthProvider.");
  return ctx;
}
