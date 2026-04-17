const buckets = new Map();

export const resetRateLimitBuckets = () => {
  buckets.clear();
};

export const rateLimit = ({ windowMs, max, keyGenerator }) => (req, res, next) => {
  const key = keyGenerator ? keyGenerator(req) : req.ip;
  const now = Date.now();

  const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json({
      success: false,
      message: "Too many requests",
      data: null,
    });
  }

  next();
};
