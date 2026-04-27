import { toast } from "sonner";

type Options = {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export function confirmToast(message: string, options: Options = {}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const fn = options.destructive ? toast.warning : toast;
    const id = fn(message, {
      duration: 10000,
      action: {
        label: options.confirmLabel ?? "Confirmer",
        onClick: () => {
          settle(true);
          toast.dismiss(id);
        },
      },
      cancel: {
        label: options.cancelLabel ?? "Annuler",
        onClick: () => {
          settle(false);
          toast.dismiss(id);
        },
      },
      onAutoClose: () => settle(false),
      onDismiss: () => settle(false),
    });
  });
}
