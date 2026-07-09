import "dotenv/config";
import Redis from "ioredis";

if (!process.env.REDIS_URL) {
  console.error("❌ REDIS_URL is not defined in .env");
  process.exit(1);
}

const redis = new Redis(process.env.REDIS_URL);

redis.on("connect", () => {
  console.log("☁️ Successfully connected to Upstash Cloud Redis!");
});

redis.on("error", (err) => {
  console.error("❌ Redis connection failed:", err.message);
});

async function runTest() {
  try {
    console.log("⏳ Setting a test key in Redis...");
    await redis.set("test_key", "Hello from ChaiAurBackend!");
    
    console.log("⏳ Getting the test key from Redis...");
    const value = await redis.get("test_key");
    
    console.log("✅ Retrieved value:", value);
    
    // Clean up
    await redis.del("test_key");
    console.log("🧹 Cleaned up test key.");
  } catch (error) {
    console.error("❌ Test encountered an error:", error);
  } finally {
    redis.quit();
  }
}

runTest();