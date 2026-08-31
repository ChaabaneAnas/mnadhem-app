"use client"

import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react"
import { Toast as ToastPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { dismissToast, useToasts, type ToastVariant } from "@/hooks/use-toast"

/**
 * Mounted once in the locale layout. Uses Radix Toast from the already-installed
 * unified `radix-ui` package rather than adding sonner.
 */

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: "border-border bg-card text-foreground",
  success:
    "border-green-200 dark:border-green-900/60 bg-green-50 dark:bg-green-950/40 text-green-900 dark:text-green-300",
  // Partial results land here: something worked, something did not.
  warning:
    "border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300",
  destructive:
    "border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300",
}

const VARIANT_ICONS: Record<ToastVariant, React.ElementType | null> = {
  default: null,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
}

export function Toaster() {
  const toasts = useToasts()

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => {
        const Icon = VARIANT_ICONS[t.variant]
        return (
          <ToastPrimitive.Root
            key={t.id}
            open
            onOpenChange={(open) => {
              if (!open) dismissToast(t.id)
            }}
            className={cn(
              "pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border p-3.5 shadow-md",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
              VARIANT_STYLES[t.variant]
            )}
          >
            {Icon && <Icon size={15} className="mt-px shrink-0" />}
            <div className="flex-1 space-y-0.5">
              {t.title && (
                <ToastPrimitive.Title className="text-xs font-semibold">
                  {t.title}
                </ToastPrimitive.Title>
              )}
              {t.description && (
                <ToastPrimitive.Description className="text-xs leading-relaxed opacity-90">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              className="shrink-0 rounded-sm opacity-60 transition-opacity hover:opacity-100"
              aria-label="Close"
            >
              <X size={13} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )
      })}

      {/* Anchored to the inline-end edge so it follows the reading direction in Arabic. */}
      <ToastPrimitive.Viewport className="pointer-events-none fixed bottom-0 end-0 z-100 flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-sm" />
    </ToastPrimitive.Provider>
  )
}
