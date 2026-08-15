import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bus,
  CheckSquare,
  Droplets,
  Factory,
  HelpCircle,
  History,
  Lock,
  MessageCircle,
  Newspaper,
  PartyPopper,
  Shield,
  Store,
  Users,
  Volume2,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { PromptModule } from "@/lib/prompt-modules";

const ICONS: Record<string, LucideIcon> = {
  basic: Activity,
  vik: Droplets,
  ethnos: Users,
  transport: Bus,
  power: Zap,
  security: Shield,
  social: Newspaper,
  services: Store,
  industry: Factory,
  connectivity: Wifi,
  culture: PartyPopper,
  media: MessageCircle,
  risks: AlertTriangle,
  "onsite-checklist": CheckSquare,
  environment: Volume2,
  history: History,
};

export function ModuleCard({
  module,
  selected,
  onToggle,
}: {
  module: PromptModule;
  selected: boolean;
  onToggle: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const Icon = ICONS[module.id] ?? Activity;

  return (
    <div
      role="checkbox"
      tabIndex={module.required ? -1 : 0}
      aria-checked={selected}
      aria-disabled={module.required ? true : undefined}
      onClick={module.required ? undefined : onToggle}
      onKeyDown={(e) => {
        if (module.required) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "wrap-anywhere flex h-full items-start gap-3 rounded-lg border p-4 shadow-sm outline-none transition-all duration-200",
        module.required
          ? "cursor-default border-primary/40 bg-primary/10"
          : "cursor-pointer hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/10 focus-visible:ring-2 focus-visible:ring-ring active:translate-y-0 active:scale-[0.98] active:shadow-sm",
        selected
          ? "border-primary/40 bg-primary/10"
          : "border-border bg-muted/40",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0 transition-colors duration-200",
          selected ? "text-primary" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          <span
            className={cn(
              "text-sm font-semibold transition-colors duration-200",
              selected ? "text-primary" : "text-foreground",
            )}
          >
            {module.label}
          </span>
          {module.required && (
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
              <Lock className="h-3 w-3" /> Задължителен
            </span>
          )}
          <Popover open={infoOpen} onOpenChange={setInfoOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Информация за „${module.label}“`}
                onClick={(e) => {
                  e.stopPropagation();
                  setInfoOpen((o) => !o);
                }}
                onMouseEnter={() => setInfoOpen(true)}
                onMouseLeave={() => setInfoOpen(false)}
                className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              onClick={(e) => e.stopPropagation()}
              className="w-72 text-sm leading-snug"
            >
              {module.info}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
