// Rate limiter middleware
// Currently disabled — using passthrough for both Vercel and local dev.
// When re-enabling, use express-rate-limit with RedisStore for local,
// and in-memory store for Vercel.

export const globalLimiter = (req, res, next) => next();
export const authLimiter = (req, res, next) => next();
