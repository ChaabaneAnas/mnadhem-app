'use client';

import { useTranslations } from 'next-intl';

/**
 * Error carrying a stable backend error code (e.g. `ORDER_NOT_FOUND`).
 * The code travels in the Error `message` so it survives the Server Action
 * boundary (where Error identity is lost); `useErrorMessage` maps it to a
 * translated string. Unknown/redacted codes fall back to `errors.unknown`.
 */
export class ApiError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ApiError';
  }
}

/** Extracts the error code from any thrown value (ApiError, Error, or unknown). */
export function errorCode(err: unknown): string {
  if (err instanceof ApiError) return err.code;
  if (err instanceof Error && err.message) return err.message;
  return 'unknown';
}

/**
 * Hook returning a translator for thrown API errors. Maps a backend code to
 * its localized message, falling back to a generic message for unknown codes.
 */
export function useErrorMessage() {
  const t = useTranslations('errors');
  return (err: unknown): string => {
    const code = errorCode(err);
    return t.has(code) ? t(code) : t('unknown');
  };
}
