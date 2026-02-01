export type WindowLimit = {
  maxRequests: number;
  windowSeconds: number;
};

export class FixedWindowLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private count = 0;
  private windowStart = Date.now();

  constructor(limit: WindowLimit) {
    this.maxRequests = limit.maxRequests;
    this.windowMs = limit.windowSeconds * 1000;
  }

  consume(now = Date.now()): boolean {
    if (now - this.windowStart >= this.windowMs) {
      this.windowStart = now;
      this.count = 0;
    }
    if (this.count >= this.maxRequests) return false;
    this.count += 1;
    return true;
  }

  remaining(now = Date.now()): number {
    if (now - this.windowStart >= this.windowMs) return this.maxRequests;
    return Math.max(0, this.maxRequests - this.count);
  }

  resetAt(): number {
    return this.windowStart + this.windowMs;
  }
}
