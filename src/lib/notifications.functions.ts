import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NotificationRow } from "@/lib/notifications.server";

export type MyNotifications = { items: NotificationRow[]; unread: number };

/** Последните известия на потребителя и броят непрочетени. Без таблица → празно. */
export const getMyNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyNotifications> => {
    const { listNotifications } = await import("@/lib/notifications.server");
    return listNotifications(context.userId).catch(() => ({ items: [], unread: 0 }));
  });

/** Маркира всички известия като прочетени (при отваряне на камбанката). */
export const markMyNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { markAllRead } = await import("@/lib/notifications.server");
    await markAllRead(context.userId).catch(() => undefined);
    return { ok: true };
  });
