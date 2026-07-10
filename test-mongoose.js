import mongoose from "mongoose";
import { Video } from "./src/models/video.model.js";
mongoose.set('bufferCommands', false);
try {
  await mongoose.connect("mongodb+srv://invalid:invalid@cluster0.mongodb.net", { serverSelectionTimeoutMS: 2000 });
} catch (e) { console.error("failed"); }
try {
  console.log("Testing aggregatePaginate...");
  await Video.aggregatePaginate(Video.aggregate([{ $match: {} }]), { page: 1, limit: 10 });
  console.log("Success!");
} catch (e) {
  console.error("Error:", e.message);
}
process.exit(0);
