import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Сесията се чете локално (без заявка към сървъра) — иначе всяка навигация чака мрежата.
    // Достъпът до данните така или иначе се проверява от сървърните функции и правилата в базата.
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/vhod" });
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
