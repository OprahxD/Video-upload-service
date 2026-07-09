import dotenv from "dotenv";
import connectDB from "../src/db/index.js";
import { app } from "../src/app.js";

dotenv.config({
    path: './.env'
});

// Connect to DB once during cold start using top-level await
try {
    await connectDB();
} catch (error) {
    console.error("DB connection error in serverless entry:", error);
}

export default app;
