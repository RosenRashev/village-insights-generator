import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";

export function PendingApproval() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center">
      <Clock className="mx-auto h-8 w-8 text-primary" />
      <h2 className="mt-4 text-xl font-bold text-primary">Регистрацията ти е получена</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Регистрацията ти е получена и очаква одобрение. Ще получиш достъп скоро.
      </p>
      <Link to="/" className="mt-6 inline-block text-sm text-primary underline">
        Към началната страница
      </Link>
    </div>
  );
}
