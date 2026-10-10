import { createFileRoute, Outlet, redirect, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Сесията се чете локално (без заявка към сървъра) — иначе всяка навигация чака мрежата.
    // Достъпът до данните така или иначе се проверява от сървърните функции и правилата в базата.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/vhod", search: { redirect: location.href } });
    return { user: data.session.user };
  },
  component: AuthenticatedLayout,
});

/**
 * `beforeLoad` се изпълнява само при навигация. Затова тук следим и сесията по време на
 * престоя на страницата: при изход или изтекла сесия не остава празна защитена страница.
 */
function AuthenticatedLayout() {
  const { loading, session, signedOutByUser } = useAuth();
  const router = useRouter();
  const href = useLocation({ select: (l) => l.href });

  useEffect(() => {
    if (loading || session) return;
    if (signedOutByUser()) {
      router.history.push("/");
    } else {
      router.history.push(`/vhod?redirect=${encodeURIComponent(href)}`);
    }
  }, [loading, session, signedOutByUser, router, href]);

  return <Outlet />;
}
