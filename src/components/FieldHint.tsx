import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Info } from "lucide-react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/** След колко време балончето се скрива само, за да не остава „заседнало“ на екрана. */
const AUTO_HIDE_MS = 7000;

/**
 * Информационно балонче към поле или блок.
 * - Показва се, когато мишката е върху блока или фокусът е в него (удобно при писане в поле);
 * - иконата „i“ в ъгъла го показва/скрива при докосване (телефон);
 * - скрива се само след няколко секунди, при излизане от блока, при Esc или клик извън него;
 * - с `disabled` (напр. докато се генерира или е показан докладът) нито балончето, нито иконата се виждат.
 */
export function FieldHint({
  text,
  title,
  children,
  className,
  disabled = false,
}: {
  text: ReactNode;
  title?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const wide = useMediaQuery("(min-width: 1280px)");

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setVisible(false);
  }, []);

  const show = useCallback(() => {
    if (disabled) return;
    setVisible(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }, [disabled]);

  // Блокът се изключва (генериране, показан доклад) — затваряме веднага.
  useEffect(() => {
    if (disabled) hide();
  }, [disabled, hide]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Popover
      open={visible && !disabled}
      onOpenChange={(next) => {
        if (!next) hide();
      }}
    >
      <PopoverAnchor asChild>
        <div
          ref={anchorRef}
          className={cn("relative", className)}
          // Само мишка: при докосване „hover“ събитията не се изпращат надеждно и балончето би заседнало.
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") show();
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") hide();
          }}
          // Фокусът върху самата иконата „i“ не отваря балончето — това прави кликът (иначе тапването го отваря и веднага затваря).
          onFocusCapture={(e) => {
            if ((e.target as HTMLElement).dataset["hintToggle"] !== undefined) return;
            show();
          }}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
          }}
        >
          {children}
          {!disabled && (
            <button
              type="button"
              data-hint-toggle=""
              onClick={() => (visible ? hide() : show())}
              aria-label={title ? `Информация: ${title}` : "Информация"}
              aria-expanded={visible}
              className="absolute right-0 top-0 grid h-6 w-6 place-items-center rounded-full text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        role="tooltip"
        side={wide ? "right" : "top"}
        align={wide ? "start" : "center"}
        sideOffset={14}
        collisionPadding={12}
        // Докосване/клик/фокус във самия блок не са „извън“ него (иначе балончето се затваря веднага).
        onInteractOutside={(e) => {
          if (anchorRef.current?.contains(e.target as Node | null)) e.preventDefault();
        }}
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
