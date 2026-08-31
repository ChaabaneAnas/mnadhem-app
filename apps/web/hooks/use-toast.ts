"use client"

import * as React from "react"

/**
 * Minimal toast store.
 *
 * The app had no success feedback at all before this — errors rendered as an
 * inline red div and success was implied by `revalidatePath` changing the row.
 * That has no home for a partial result ("3 requested, 2 skipped"), which is
 * exactly what the bulk fulfillment actions return.
 */

export type ToastVariant = "default" | "success" | "warning" | "destructive"

export interface Toast {
  id: string
  title?: string
  description?: string
  variant: ToastVariant
  /** Milliseconds before auto-dismiss. */
  duration: number
}

export type ToastInput = Omit<Partial<Toast>, "id">

// Long enough to read a two-line partial-result message without racing the
// reader, short enough not to stack up during a batch of row actions.
const DEFAULT_DURATION = 6000
const MAX_VISIBLE = 4

let toasts: Toast[] = []
const listeners = new Set<(next: Toast[]) => void>()

function emit() {
  for (const listener of listeners) listener(toasts)
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

export function toast(input: ToastInput): string {
  const id = Math.random().toString(36).slice(2)
  const next: Toast = {
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "default",
    duration: input.duration ?? DEFAULT_DURATION,
  }

  // Oldest fall off the top rather than growing a column that covers the table.
  toasts = [...toasts, next].slice(-MAX_VISIBLE)
  emit()

  if (next.duration > 0) {
    setTimeout(() => dismissToast(id), next.duration)
  }
  return id
}

export function useToasts(): Toast[] {
  return React.useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => toasts,
    // Server render has no toasts; a stable empty array avoids a hydration loop.
    () => EMPTY,
  )
}

const EMPTY: Toast[] = []
