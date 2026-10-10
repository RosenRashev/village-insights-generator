import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Съобщение при неуспешно зареждане с бутон „Опитай пак“ (вместо вечен спинър). */
export function LoadFailed({
  message = "Неуспешно зареждане.",
  onRetry,
  retrying = false,
}: {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="mx-auto mt-8 flex max-w-sm flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
    >
      <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
      <p className="text-sm">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying && <Loader2 className="h-4 w-4 animate-spin" />}
        Опитай пак
      </Button>
    </div>
  );
}

/** Цял екран със спинър, а при грешка при зареждане на профила — съобщение с повторен опит. */
export function FullPageLoading({
  profileError,
  onRetry,
}: {
  profileError?: boolean;
  onRetry?: () => void;
}) {
  if (profileError && onRetry) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <LoadFailed message="Профилът ви не успя да се зареди." onRetry={onRetry} />
      </main>
    );
  }
  return (
    <main className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Зареждане" />
    </main>
  );
}
