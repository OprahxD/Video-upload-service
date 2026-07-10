import dotenv from "dotenv";
import connectDB from "../src/db/index.js";
import { app } from "../src/app.js";

dotenv.config({
    path: './.env'
});

// Initiate DB connection but DO NOT block the serverless execution
// This prevents Vercel from hanging and causing a 10s timeout if MongoDB Atlas IP whitelisting is blocking the connection.
connectDB().catch((error) => {
    console.error("DB connection error in serverless entry:", error);
});

export default app;
