export class FixedWindowLimiter {
    maxRequests;
    windowMs;
    count = 0;
    windowStart = Date.now();
    constructor(limit) {
        this.maxRequests = limit.maxRequests;
        this.windowMs = limit.windowSeconds * 1000;
    }
    consume(now = Date.now()) {
        if (now - this.windowStart >= this.windowMs) {
            this.windowStart = now;
            this.count = 0;
        }
        if (this.count >= this.maxRequests)
            return false;
        this.count += 1;
        return true;
    }
    remaining(now = Date.now()) {
        if (now - this.windowStart >= this.windowMs)
            return this.maxRequests;
        return Math.max(0, this.maxRequests - this.count);
    }
    resetAt() {
        return this.windowStart + this.windowMs;
    }
}
