import { Redis } from "ioredis";

let redisClient = null;

if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null, // Required by BullMQ
        enableOfflineQueue: false, // Don't queue commands when offline (fail fast)
        connectTimeout: 5000,      // Timeout connection attempts in 5 seconds
    });

    redisClient.on("connect", () => {
        console.log("☁️ Successfully connected to Redis!");
    });

    redisClient.on("error", (err) => {
        console.error("❌ Redis connection failed:", err.message);
    });
} else {
    console.warn("⚠️ REDIS_URL is not defined in .env - Redis features will be disabled.");
}

const redis = {
    get: async (key) => {
        try {
            if (!redisClient) return null;
            return await redisClient.get(key);
        } catch (err) {
            console.error("Redis GET error:", err.message);
            return null;
        }
    },
    setex: async (key, seconds, value) => {
        try {
            if (!redisClient) return null;
            return await redisClient.setex(key, seconds, value);
        } catch (err) {
            console.error("Redis SETEX error:", err.message);
            return null;
        }
    },
    zincrby: async (key, increment, member) => {
        try {
            if (!redisClient) return 0;
            return await redisClient.zincrby(key, increment, member);
        } catch (err) {
            console.error("Redis ZINCRBY error:", err.message);
            return 0;
        }
    },
    zrevrange: async (key, start, stop) => {
        try {
            if (!redisClient) return [];
            return await redisClient.zrevrange(key, start, stop);
        } catch (err) {
            console.error("Redis ZREVRANGE error:", err.message);
            return [];
        }
    }
};

export { redis };
