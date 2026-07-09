import { Redis } from "ioredis";

if (!process.env.REDIS_URL) {
    console.error("❌ REDIS_URL is not defined in .env - Redis features will be disabled.");
}

// Reusable Redis connection instance
const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
});

redis.on("connect", () => {
    console.log("☁️ Successfully connected to Redis!");
});

redis.on("error", (err) => {
    console.error("❌ Redis connection failed:", err.message);
});

export { redis };
