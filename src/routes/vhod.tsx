import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const TITLE = "Вход и регистрация — Къде Да";
const DESCRIPTION =
  "Влезте в профила си или си създайте акаунт в Къде Да, за да генерирате и запазвате доклади за населени места.";

export const Route = createFileRoute("/vhod")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) void navigate({ to: "/profil" });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Успешен вход.");
        void navigate({ to: "/" });
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success(
          "Регистрацията е получена. Потвърдете имейла си — достъпът се активира след одобрение.",
        );
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/nova-parola`,
        });
        if (error) throw error;
        toast.success("Изпратихме имейл за възстановяване на паролата.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Неуспешен опит.");
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        toast.error("Входът с Google не бе успешен.");
        setBusy(false);
        return;
      }
      // Успешният случай пренасочва браузъра към Google, така че компонентът
      // напуска страницата тук — няма нужда от допълнителна навигация или setBusy(false).
    } catch {
      toast.error("Входът с Google не бе успешен.");
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-center text-3xl font-bold text-primary">
        {mode === "signup" ? "Регистрация" : mode === "forgot" ? "Забравена парола" : "Вход"}
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {mode === "forgot"
          ? "Въведете имейла си и ще ви изпратим линк за нова парола."
          : "Акаунтът дава достъп до генериране и запазване на доклади."}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Имейл</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        {mode !== "forgot" && (
          <div className="space-y-2">
            <Label htmlFor="password">Парола</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "signup" ? "Създай акаунт" : mode === "forgot" ? "Изпрати линк" : "Влез"}
        </Button>
      </form>

      {mode !== "forgot" && (
        <>
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">или</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={googleSignIn} disabled={busy}>
            Продължи с Google
          </Button>
        </>
      )}

      <div className="mt-6 space-y-2 text-center text-sm">
        {mode === "signin" && (
          <>
            <button type="button" className="text-primary underline" onClick={() => setMode("signup")}>
              Нямате акаунт? Регистрирайте се
            </button>
            <br />
            <button
              type="button"
              className="text-muted-foreground underline"
              onClick={() => setMode("forgot")}
            >
              Забравена парола
            </button>
          </>
        )}
        {mode !== "signin" && (
          <button type="button" className="text-primary underline" onClick={() => setMode("signin")}>
            Назад към вход
          </button>
        )}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Нови регистрации изчакват ръчно одобрение.{" "}
        <Link to="/" className="underline">
          Към началната страница
        </Link>
      </p>
    </main>
  );
}
