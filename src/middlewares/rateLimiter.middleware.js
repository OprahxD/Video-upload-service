import { rateLimit } from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { redis } from "../db/redis.js";

// TODO: Restore rate limiting before production deployment
export const globalLimiter = (req, res, next) => next();
export const authLimiter = (req, res, next) => next();
