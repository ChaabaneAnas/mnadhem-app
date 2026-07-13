"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

/**
 * Centered popup on desktop, bottom drawer on mobile (<768px).
 * The wrapper owns the header (title + close) and a scrollable body.
 */
function ResponsiveModal({
  title,
  onClose,
  children,
  width = "max-w-md",
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Desktop max-width. */
  width?: string
}) {
  const isMobile = useIsMobile()
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  if (isMobile) {
    return (
        <Drawer open onOpenChange={handleOpenChange}>
            <DrawerContent className="bg-card">
                <DrawerHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-5 py-4 text-start">
                    <DrawerTitle className="text-center sm:text-left text-sm font-semibold text-foreground">
                        {title}
                    </DrawerTitle>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={onClose}
                        className="hidden sm:block text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
                    >
                        <XIcon size={16} />
                    </Button>
                </DrawerHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {children}
                </div>
            </DrawerContent>
        </Drawer>
    );
  }

  return (
      <Dialog open onOpenChange={handleOpenChange}>
          <DialogContent
              showCloseButton={false}
              className={cn(
                  'bg-card border-border shadow-lg p-0 gap-0 max-h-[90vh] overflow-y-auto',
                  width
              )}
          >
              <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-5 py-4">
                  <DialogTitle className="text-sm font-semibold text-foreground">
                      {title}
                  </DialogTitle>
                  <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={onClose}
                      className="text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground"
                  >
                      <XIcon size={16} />
                  </Button>
              </DialogHeader>
              <div className="px-5 py-4">{children}</div>
          </DialogContent>
      </Dialog>
  );
}

/**
 * Side sheet on desktop, bottom drawer on mobile (<768px).
 * The caller supplies its own header / body / footer as children; this shell
 * only swaps the container and provides the accessible (sr-only) title so both
 * the Radix Sheet and the vaul Drawer satisfy their dialog-title requirement.
 * `className` applies to the desktop SheetContent only.
 */
function ResponsiveSheet({
  title,
  onClose,
  side = "right",
  className,
  children,
}: {
  title: string
  onClose: () => void
  side?: "top" | "right" | "bottom" | "left"
  className?: string
  children: React.ReactNode
}) {
  const isMobile = useIsMobile()
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  if (isMobile) {
    return (
      <Drawer open onOpenChange={handleOpenChange}>
        <DrawerContent className="bg-card">
          <DrawerTitle className="sr-only">{title}</DrawerTitle>
          {children}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open onOpenChange={handleOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className={cn(
          "w-full sm:max-w-lg bg-card border-border flex h-full flex-col gap-0 p-0",
          className
        )}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  )
}

export { ResponsiveModal, ResponsiveSheet }
