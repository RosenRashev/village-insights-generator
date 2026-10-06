import { useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Info } from "lucide-react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/**
 * Информационно балонче към поле или блок.
 * - Показва се, когато мишката е върху блока или фокусът е в него (удобно при писане в поле);
 * - иконата „i“ в ъгъла го показва/скрива при докосване (телефон);
 * - на широк екран излиза отстрани, на малък — над блока; Esc и клик извън го затварят.
 */
export function FieldHint({
  text,
  title,
  children,
  className,
}: {
  text: ReactNode;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wide = useMediaQuery("(min-width: 1280px)");
  const open = hover || focus || pinned;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPinned(false);
          setHover(false);
        }
      }}
    >
      <PopoverAnchor asChild>
        <div
          className={cn("relative", className)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocusCapture={() => setFocus(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false);
          }}
        >
          {children}
          <button
            type="button"
            onClick={() => setPinned((v) => !v)}
            aria-label={title ? `Информация: ${title}` : "Информация"}
            aria-expanded={open}
            className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-full text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        role="tooltip"
        side={wide ? "right" : "top"}
        align={wide ? "start" : "center"}
        sideOffset={14}
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border-primary/25 bg-card p-3.5 text-sm leading-relaxed text-foreground shadow-xl"
      >
        {title && <p className="mb-1 font-semibold text-primary">{title}</p>}
        <p className="text-muted-foreground">{text}</p>
        <PopoverPrimitive.Arrow className="fill-card" width={14} height={7} />
      </PopoverContent>
    </Popover>
  );
}
