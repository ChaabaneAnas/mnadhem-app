import { BadGatewayException, Logger } from '@nestjs/common';

/**
 * Minimal outbound HTTP for courier calls, on global `fetch`.
 *
 * No client library: Node is pinned >=20.19 so `fetch` is built in, and
 * apps/web/lib/api.ts already talks to the API this way. Adding axios here
 * would buy interceptors nothing in this codebase uses.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

const logger = new Logger('CourierHttp');

export interface CourierRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
}

/**
 * Any failure reaching or understanding a carrier. Carries a stable `code` so
 * `main.ts`'s error shape reaches the frontend translatable, and `detail` for
 * the Test-connection panel — carriers explain misconfiguration in their body,
 * and hiding that makes debugging a merchant's setup impossible.
 */
export class CourierApiError extends BadGatewayException {
  constructor(
    readonly detail: string,
    code = 'COURIER_API_ERROR',
  ) {
    super({ code, message: detail });
  }
}

/** Truncated so a carrier returning an HTML error page cannot flood the logs. */
function summarize(body: string): string {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  return collapsed.length > 300 ? `${collapsed.slice(0, 300)}…` : collapsed;
}

export async function courierFetch(request: CourierRequest): Promise<unknown> {
  const { url, method, headers = {}, body, timeoutMs = DEFAULT_TIMEOUT_MS } = request;

  // A carrier that accepts the connection then stalls would otherwise hold the
  // request open indefinitely — and bulk AWB generation calls this in a loop.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? `no response within ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : 'unknown network failure';
    logger.warn(`${method} ${url} failed: ${reason}`);
    throw new CourierApiError(`Could not reach the carrier: ${reason}`, 'COURIER_UNREACHABLE');
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();

  if (!response.ok) {
    logger.warn(`${method} ${url} → ${response.status}: ${summarize(text)}`);
    throw new CourierApiError(
      `Carrier returned ${response.status}: ${summarize(text) || 'no response body'}`,
      response.status === 401 || response.status === 403
        ? 'COURIER_AUTH_REJECTED'
        : 'COURIER_API_ERROR',
    );
  }

  if (text.trim() === '') return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CourierApiError(
      `Carrier returned a non-JSON body: ${summarize(text)}`,
      'COURIER_BAD_RESPONSE',
    );
  }
}

/**
 * Downloads a carrier-hosted label so its bytes can be stored alongside the
 * shipment. Bulk "Print Labels" merges stored bytes; if labels lived only as
 * remote URLs, printing 40 of them would mean 40 network round-trips, and a
 * carrier expiring its links would silently break reprinting.
 *
 * Returns null rather than throwing — a missing label should not fail an
 * otherwise successful AWB generation, since the waybill itself is what matters.
 */
export async function fetchLabelPdf(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      logger.warn(`Label download ${url} → ${response.status}; keeping the URL only`);
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (err) {
    logger.warn(
      `Label download ${url} failed: ${err instanceof Error ? err.message : 'unknown'}; keeping the URL only`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}
