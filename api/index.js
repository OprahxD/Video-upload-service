import dotenv from "dotenv";
import connectDB from "../src/db/index.js";
import { app } from "../src/app.js";

dotenv.config({
    path: './.env'
});

// Connect to DB during cold start.
// Top-level await ensures the DB is ready before any request is processed.
// This is safe because MongoDB Atlas is configured to allow all IPs (0.0.0.0/0)
// and serverSelectionTimeoutMS is set to 5000ms so it won't hang forever.
try {
    await connectDB();
    console.log("✅ Serverless function ready.");
} catch (error) {
    console.error("⚠️ DB connection failed during cold start:", error.message);
    // Don't crash - let Express handle requests; DB-dependent routes will fail gracefully
}

export default app;
