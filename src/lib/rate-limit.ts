import { LRUCache } from "lru-cache";
import { NextRequest } from "next/server";

export interface RateLimitOptions {
  uniqueTokenPerInterval?: number;
  interval?: number;
}

export interface RateLimiterResponse {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
}

export class RateLimiter {
  private tokenCache: LRUCache<string, number>;

  constructor(options?: RateLimitOptions) {
    this.tokenCache = new LRUCache({
      max: options?.uniqueTokenPerInterval || 500,
      ttl: options?.interval || 60000,
    });
  }

  async check(
    req: NextRequest,
    limit: number,
    token: string = ""
  ): Promise<RateLimiterResponse> {
    const tokenKey = token || this.getTokenFromRequest(req);
    const currentTime = Date.now();
    let tokenCount = (this.tokenCache.get(tokenKey) as number) || 0;

    // Initialize or reset counter
    if (!this.tokenCache.has(tokenKey)) {
      tokenCount = 0;
      this.tokenCache.set(tokenKey, tokenCount);
    }

    const ttl = this.tokenCache.ttl || 60000;
    const resetTime = new Date(currentTime + ttl);

    if (tokenCount >= limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset: resetTime,
      };
    }

    this.tokenCache.set(tokenKey, tokenCount + 1);

    return {
      success: true,
      limit,
      remaining: limit - (tokenCount + 1),
      reset: resetTime,
    };
  }

  private getTokenFromRequest(req: NextRequest): string {
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    return `${ip}:${req.nextUrl.pathname}`;
  }
}

// Create rate limiters with different configurations
export const authRateLimiter = new RateLimiter({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 500,
});

export const apiRateLimiter = new RateLimiter({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 1000,
});

export const transferRateLimiter = new RateLimiter({
  interval: 24 * 60 * 60 * 1000, // 24 hours
  uniqueTokenPerInterval: 1000,
});
