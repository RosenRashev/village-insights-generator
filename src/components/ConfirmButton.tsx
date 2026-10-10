import { useState, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Бутон с потвърждение за необратими действия (изтриване, нулиране, отнемане на достъп).
 * Действието тръгва чак след „Потвърди“; диалогът се затваря само при успех или отказ.
 */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel = "Потвърди",
  onConfirm,
  destructive = true,
  ariaLabel,
  ...buttonProps
}: {
  children: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
  ariaLabel?: string;
} & Omit<ButtonProps, "onClick" | "title" | "children">) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button
        type="button"
        {...buttonProps}
        {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отказ</AlertDialogCancel>
            <Button
              variant={destructive ? "destructive" : "default"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
