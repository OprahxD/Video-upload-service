import dotenv from "dotenv";
import connectDB from "../src/db/index.js";
import { app } from "../src/app.js";

dotenv.config({
    path: './.env'
});

let isConnected = false;

export default async (req, res) => {
    if (!isConnected) {
        try {
            await connectDB();
            isConnected = true;
        } catch (error) {
            console.error("DB connection error in serverless entry:", error);
        }
    }
    return app(req, res);
};
