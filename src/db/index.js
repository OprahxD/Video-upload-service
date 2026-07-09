import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async ()=>{
  try{
    const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`, {
      serverSelectionTimeoutMS: 5000 // Fails fast in 5 seconds if IP is not whitelisted
    });
    console.log(`\n MongoDB connected: ${connectionInstance.connection.host}\n`);
  }catch(err){
    console.error("MONGODB CONNECTION ERROR:", err.message);
    // Removed process.exit(1) to prevent Vercel 502 Bad Gateway crashes
  }
}

export default connectDB;