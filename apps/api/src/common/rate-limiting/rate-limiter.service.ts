import { Injectable, HttpException, HttpStatus, OnModuleDestroy } from '@nestjs/common';

interface RateLimitRecord {
  timestamps: number[];
  lastUpdated: number;
}

export class RateLimitedException extends HttpException {
  public readonly retryAfter: number;

  constructor(retryAfterSeconds: number) {
    super(
      {
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Has hecho varios intentos. Espera un momento y vuelve a intentar',
        retryAfter: retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.retryAfter = retryAfterSeconds;
  }
}

@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private records = new Map<string, RateLimitRecord>();
  private readonly maxEntries = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // guardrails-ignore G-B08: limpieza en memoria cada 5 min de registros expirados de rate limiting (SEC-09b)
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
    this.cleanupInterval.unref?.();
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Checks and consumes 1 token for the specified key within the given window.
   * If limit exceeded, throws RateLimitedException with Retry-After seconds.
   */
  check(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record) {
      // LRU eviction if maximum capacity reached (RF-04)
      if (this.records.size >= this.maxEntries) {
        const oldestKey = this.records.keys().next().value;
        if (oldestKey) {
          this.records.delete(oldestKey);
        }
      }
      record = { timestamps: [], lastUpdated: now };
      this.records.set(key, record);
    } else {
      // Refresh LRU position
      this.records.delete(key);
      this.records.set(key, record);
    }

    record.lastUpdated = now;

    // Filter out timestamps outside window
    const windowStart = now - windowMs;
    record.timestamps = record.timestamps.filter((t) => t > windowStart);

    if (record.timestamps.length >= limit) {
      const oldest = record.timestamps[0] ?? now;
      const retryAfterMs = oldest + windowMs - now;
      const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
      throw new RateLimitedException(retryAfterSec);
    }

    record.timestamps.push(now);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      // If no activity in the last 10 minutes, remove
      if (now - record.lastUpdated > 10 * 60 * 1000) {
        this.records.delete(key);
      }
    }
  }

  /**
   * Cleans up expired records or resets all for testing.
   */
  reset(): void {
    this.records.clear();
  }
}
