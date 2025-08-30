// import { RateLimiter } from 'ratelimiter';

const redis = new Map();

export class SimpleRateLimiter {
  private limiters = new Map<string, { count: number; resetTime: number }>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async check(key: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const limiter = this.limiters.get(key);

    if (!limiter || now >= limiter.resetTime) {
      // Reset or create new limiter
      const resetTime = now + this.windowMs;
      this.limiters.set(key, { count: 1, resetTime });
      return { allowed: true, remaining: this.maxRequests - 1, resetTime };
    }

    if (limiter.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetTime: limiter.resetTime };
    }

    limiter.count++;
    return { 
      allowed: true, 
      remaining: this.maxRequests - limiter.count, 
      resetTime: limiter.resetTime 
    };
  }
}

export const rateLimiter = new SimpleRateLimiter(10, 60000); // 10 requests per minute