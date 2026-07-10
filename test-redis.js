import { Redis } from "ioredis";
const redis = new Redis("redis://invalid:6379", {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 2000,
});
redis.on("error", () => {}); // Prevent unhandled error crashes
try {
  console.log("Testing redis.get...");
  await redis.get("test");
  console.log("Success!");
} catch (e) {
  console.error("Error:", e.message);
}
process.exit(0);
