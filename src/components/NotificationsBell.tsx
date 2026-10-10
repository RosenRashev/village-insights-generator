import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { timeAgo } from "@/lib/credit-labels";
import { getMyNotifications, markMyNotificationsRead } from "@/lib/notifications.functions";

/** Колко известия показваме в падащото меню. */
const SHOWN = 4;

/**
 * Камбанка с известия (като във Facebook): червено кръгче с броя непрочетени,
 * падащо меню с последните няколко. При отваряне всички се маркират като прочетени.
 */
export function NotificationsBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Известията са лични и се филтрират на сървъра — показваме камбанката на всеки влязъл,
  // без да чакаме профила (иначе при бавно зареждане на профила тя изчезва).
  const enabled = !!user;

  const q = useQuery({
    queryKey: ["my-notifications", user?.id],
    queryFn: () => getMyNotifications({ data: undefined }),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  if (!enabled) return null;
  const unread = q.data?.unread ?? 0;
  const items = (q.data?.items ?? []).slice(0, SHOWN);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unread > 0) {
      void markMyNotificationsRead({ data: undefined }).then(() => {
        void queryClient.invalidateQueries({ queryKey: ["my-notifications", user?.id] });
      });
    }
  };

  const label = unread > 0 ? `Известия: ${unread} нови` : "Известия";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:h-10 md:w-10"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 text-sm">
        <p className="border-b px-4 py-2.5 font-semibold">Известия</p>
        {items.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Още нямате известия.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((n) => {
              const content = (
                <>
                  <span className="flex items-start gap-2">
                    {!n.read_at && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug">{n.title}</span>
                      {n.body && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link
                      to={n.link}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-2.5 hover:bg-muted/50"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="px-4 py-2.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
