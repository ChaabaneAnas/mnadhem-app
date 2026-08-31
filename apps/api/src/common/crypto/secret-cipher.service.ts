import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Ciphertext layout: `v1:<iv>:<authTag>:<payload>`, all three parts base64url.
 *
 * The version prefix exists so stored values can be told apart from the
 * plaintext courier keys carried over from the old `Tenant.*ApiKey` columns —
 * see the fulfillment_stages_and_carrier_accounts migration, which copies them
 * across as-is because SQL cannot call this service. `decrypt` returns anything
 * without the prefix unchanged, and the value is re-encrypted the next time the
 * merchant saves it.
 */
const PREFIX = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for
const KEY_BYTES = 32;

/**
 * Symmetric encryption for credentials the app must be able to read back.
 *
 * Deliberately not bcrypt: passwords are verified by re-hashing, but a courier
 * API key has to be recovered in full to sign an outbound request.
 */
@Injectable()
export class SecretCipherService {
  private readonly logger = new Logger(SecretCipherService.name);
  private readonly key: Buffer;

  constructor() {
    this.key = SecretCipherService.loadKey();
  }

  /**
   * Reads CREDENTIALS_KEY at construction so a missing or malformed key fails
   * the process at boot, rather than the first time a merchant saves a carrier.
   */
  private static loadKey(): Buffer {
    const raw = process.env['CREDENTIALS_KEY'];
    if (!raw) {
      throw new Error(
        'CREDENTIALS_KEY is not set. Generate one with: openssl rand -base64 32',
      );
    }

    const key = Buffer.from(raw, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new Error(
        `CREDENTIALS_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}. ` +
          'Generate one with: openssl rand -base64 32',
      );
    }
    return key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const payload = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    return [
      PREFIX,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      payload.toString('base64url'),
    ].join(':');
  }

  /**
   * Returns a value stored without the `v1:` prefix untouched — that is a
   * legacy plaintext key from before this service existed, not corruption.
   */
  decrypt(stored: string): string {
    const parts = stored.split(':');
    if (parts[0] !== PREFIX) return stored;

    const [, iv, authTag, payload] = parts;
    if (parts.length !== 4 || !iv || !authTag || !payload) {
      throw new Error('Malformed ciphertext: expected v1:<iv>:<tag>:<payload>');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(payload, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** True when a stored value predates this service and is still plaintext. */
  isLegacyPlaintext(stored: string): boolean {
    return !stored.startsWith(`${PREFIX}:`);
  }

  /**
   * Trailing characters kept alongside the ciphertext so settings can render a
   * "••••1234" hint. Short secrets reveal nothing rather than most of themselves.
   */
  last4(plaintext: string): string | null {
    return plaintext.length >= 8 ? plaintext.slice(-4) : null;
  }

  /**
   * Constant-time comparison for authenticating inbound webhooks. `!==` leaks
   * how much of a guessed key was correct through its response time.
   */
  matches(candidate: string, expected: string): boolean {
    const a = Buffer.from(candidate, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    // timingSafeEqual throws on length mismatch, which would itself be a signal.
    if (a.length !== b.length) {
      timingSafeEqual(a, a);
      return false;
    }
    return timingSafeEqual(a, b);
  }

  /** Encrypts, tolerating a value that is already ciphertext (idempotent re-save). */
  encryptIfNeeded(value: string): string {
    return this.isLegacyPlaintext(value) ? this.encrypt(value) : value;
  }

  warnIfLegacy(stored: string, context: string): void {
    if (this.isLegacyPlaintext(stored)) {
      this.logger.warn(
        `${context}: credential is still legacy plaintext — it will be encrypted on next save`,
      );
    }
  }
}
