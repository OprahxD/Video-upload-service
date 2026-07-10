import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async ()=>{
  try{
    mongoose.set('bufferCommands', false); // Disable buffering so queries fail fast if DB is down
    const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`, {
      serverSelectionTimeoutMS: 5000, // Fails fast in 5 seconds if IP is not whitelisted
      maxPoolSize: 1 // Crucial for Vercel Serverless to prevent exhausting the MongoDB M0 500-connection limit
    });
    console.log(`\n MongoDB connected: ${connectionInstance.connection.host}\n`);
  }catch(err){
    console.error("MONGODB CONNECTION ERROR:", err.message);
    // Removed process.exit(1) to prevent Vercel 502 Bad Gateway crashes
  }
}

export default connectDB;