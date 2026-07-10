import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../src/db/index.js";
import { app } from "../src/app.js";

dotenv.config({
    path: './.env'
});

// Cache the connection promise so it's only called once across warm invocations
let dbPromise = null;

function ensureDbConnected() {
    if (!dbPromise) {
        dbPromise = connectDB().catch((err) => {
            console.error("DB connection failed:", err.message);
            dbPromise = null; // Reset so next invocation retries
            throw err;
        });
    }
    return dbPromise;
}

// Wrap the Express app so every Vercel invocation waits for DB first
const handler = async (req, res) => {
    try {
        await ensureDbConnected();
    } catch (error) {
        // If DB connection fails, still let Express handle the request
        // Routes that don't need DB (like healthcheck, root) will still work
        console.error("Proceeding without DB connection:", error.message);
    }
    return app(req, res);
};

export default handler;
