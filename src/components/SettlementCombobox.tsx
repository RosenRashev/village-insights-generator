import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  displaySettlement,
  loadSettlements,
  sanitizeCyrillic,
  searchSettlements,
  type Settlement,
} from "@/lib/settlements";

type Props = {
  id: string;
  label: string;
  placeholder?: string;
  value: Settlement | null;
  onChange: (s: Settlement | null) => void;
  size?: "lg" | "sm";
};

export function SettlementCombobox({
  id,
  label,
  placeholder,
  value,
  onChange,
  size = "lg",
}: Props) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState<Settlement[] | null>(null);
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open || all) return;
    let active = true;
    loadSettlements().then((data) => {
      if (active) setAll(data);
    });
    return () => {
      active = false;
    };
  }, [open, all]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const results = useMemo(
    () => (all ? searchSettlements(all, query) : []),
    [all, query],
  );

  if (value) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="flex items-center gap-2 rounded-md border border-primary bg-primary/5 px-3 py-2">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {displaySettlement(value)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(true);
            }}
          >
            <X className="h-4 w-4" />
            Смени
          </Button>
        </div>
      </div>
    );
  }

  const showHint = query.trim().length > 0;

  return (
    <div className="space-y-2" ref={wrapRef}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const raw = e.target.value;
            const clean = sanitizeCyrillic(raw);
            setBlocked(clean !== raw);
            setQuery(clean);
            setOpen(true);
          }}
          placeholder={placeholder}
          className={size === "lg" ? "h-12 text-base" : "h-10 text-sm"}
          autoComplete="off"
          spellCheck={false}
        />
        {open && query.trim().length >= 2 && (
          <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-background shadow-lg">
            {!all && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Зареждане на списъка…
              </li>
            )}
            {all && results.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Няма намерено населено място. Проверете изписването.
              </li>
            )}
            {results.map((s) => (
              <li key={s.ekatte}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                    setBlocked(false);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-primary/10"
                >
                  <span className="text-sm font-semibold">
                    {s.isVillage ? "с." : "гр."} {s.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    общ. {s.municipality}, обл. {s.province}
                    {s.postalCode ? ` · ${s.postalCode}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {blocked ? (
        <p className="text-sm font-medium text-destructive">
          Моля, пишете само на кирилица.
        </p>
      ) : showHint ? (
        <p className="text-sm text-muted-foreground">
          Изберете населено място от списъка.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Пишете на кирилица — име на населено място или пощенски код.
        </p>
      )}
    </div>
  );
}
