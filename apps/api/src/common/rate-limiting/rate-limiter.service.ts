import { Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface RateLimitRecord {
  timestamps: number[];
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
export class RateLimiterService {
  private records = new Map<string, RateLimitRecord>();

  /**
   * Checks and consumes 1 token for the specified key within the given window.
   * If limit exceeded, throws RateLimitedException with Retry-After seconds.
   */
  check(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    let record = this.records.get(key);

    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

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

  /**
   * Cleans up expired records or resets all for testing.
   */
  reset(): void {
    this.records.clear();
  }
}
