import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Frown } from "lucide-react";
import { toast } from "sonner";

import { RequestCreditsForm } from "@/components/RequestCreditsForm";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { getMyCreditRequest } from "@/lib/credits.functions";
import { creditNotice, readSeen, reportsWord, writeSeen } from "@/lib/credits-notice";
import { getMyQuota } from "@/lib/reports.functions";

/** Събитие, с което други места (напр. съобщението „Нямате доклади“) отварят балончето. */
export const OPEN_CREDITS_EVENT = "kadeda:open-credits";

/**
 * Кутийка до профила: колко нови доклада може да направи потребителят.
 * При 0 — тъжно човече. Балончето обяснява правилото и води до заявка към админа.
 * При влизане/фокус показва ненатрапчиво съобщение, ако са му заредени нови доклади.
 */
export function CreditsBadge() {
  const { user, profile } = useAuth();
  const enabled = !!user && profile?.is_approved === true;
  const [open, setOpen] = useState(false);

  const quota = useQuery({
    queryKey: ["my-quota", user?.id],
    queryFn: () => getMyQuota({ data: undefined }),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const request = useQuery({
    queryKey: ["my-credit-request", user?.id],
    queryFn: () => getMyCreditRequest({ data: undefined }),
    enabled: enabled && quota.data?.unlimited === false,
    staleTime: 60_000,
  });

  const credits = quota.data?.credits ?? null;
  const unlimited = quota.data?.unlimited === true;

  // Известие за новозаредени доклади (браузърът помни последния видян брой).
  useEffect(() => {
    if (!user || unlimited || credits === null) return;
    const notice = creditNotice(readSeen(user.id), credits);
    writeSeen(user.id, credits);
    if (notice.kind === "welcome") {
      toast(`Имате ${reportsWord(notice.credits)} на разположение.`, { duration: 6000 });
    } else if (notice.kind === "added") {
      toast.success(`Заредени са ви ${reportsWord(notice.added)} — общо ${notice.credits}.`, {
        duration: 7000,
        action: { label: "Генерирай", onClick: () => (window.location.href = "/") },
      });
    }
  }, [user, unlimited, credits]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_CREDITS_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CREDITS_EVENT, onOpen);
  }, []);

  if (!enabled || !user) return null;

  const empty = !unlimited && credits === 0;
  const label = unlimited
    ? "Нямате ограничение за доклади"
    : credits === null
      ? "Налични доклади"
      : `Налични доклади: ${credits}`;
  const pending = request.data ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          className={`inline-flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border text-sm font-bold leading-none tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 md:h-10 md:w-10 ${
            empty
              ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
              : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
          } ${credits === null && !unlimited ? "animate-pulse" : ""}`}
        >
          {empty ? (
            <Frown className="h-5 w-5" aria-hidden="true" />
          ) : (
            <FileText className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{unlimited ? "∞" : credits === null ? "" : credits}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          {empty && <Frown className="h-5 w-5 text-destructive" aria-hidden="true" />}
          {unlimited
            ? "Нямате ограничение за доклади"
            : empty
              ? "Нямате налични доклади"
              : `Налични доклади: ${credits ?? "…"}`}
        </p>
        {!unlimited && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Всеки нов доклад за място изразходва 1. Актуализацията на вече генериран доклад е
            безплатна, а отварянето на запазените ви доклади не струва нищо.
          </p>
        )}
        {!unlimited &&
          (pending ? (
            <p className="mt-3 rounded-md bg-amber-500/10 px-2.5 py-2 text-xs text-amber-800 dark:text-amber-200">
              Заявката ви за {reportsWord(pending.amount)} от{" "}
              {new Date(pending.created_at).toLocaleDateString("bg-BG")} чака одобрение.
            </p>
          ) : (
            <RequestCreditsForm userId={user.id} onDone={() => setOpen(false)} />
          ))}
        <Link
          to="/profil"
          onClick={() => setOpen(false)}
          className="mt-3 inline-block text-xs text-primary underline"
        >
          Моите доклади
        </Link>
      </PopoverContent>
    </Popover>
  );
}
