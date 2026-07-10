import { Queue, Worker } from "bullmq";
import { redis, redisClient } from "../db/redis.js";
import { Video } from "../models/video.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";

export let uploadQueue;

if (redisClient && !process.env.VERCEL) {
    uploadQueue = new Queue("video-uploads", { connection: redisClient });
} else {
    console.warn("⚠️ Vercel/Mock mode active. BullMQ is disabled to prevent serverless timeouts.");
    uploadQueue = {
        add: async (name, data) => {
            console.log(`[MockQueue] Running job '${name}' synchronously...`);
            const { videoId, localVideoPath, localThumbnailPath } = data;
            try {
                // Upload to Cloudinary
                const videoLink = await uploadOnCloudinary(localVideoPath);
                const thumbnailLink = await uploadOnCloudinary(localThumbnailPath);

                if (!videoLink?.url || !thumbnailLink?.url) {
                    throw new Error("Failed to upload to Cloudinary");
                }

                // Update Database
                await Video.findByIdAndUpdate(videoId, {
                    videoFile: videoLink.url,
                    thumbnail: thumbnailLink.url,
                    duration: videoLink.duration || 0,
                    uploadStatus: "completed",
                    isPublished: true,
                });
                console.log(`[MockQueue] Successfully processed Video ID: ${videoId}`);
            } catch (error) {
                console.error(`[MockQueue] Failed processing Video ID: ${videoId}`, error);
                await Video.findByIdAndUpdate(videoId, { uploadStatus: "failed" });
            } finally {
                // Cleanup local files safely
                if (localVideoPath && fs.existsSync(localVideoPath)) fs.unlinkSync(localVideoPath);
                if (localThumbnailPath && fs.existsSync(localThumbnailPath)) fs.unlinkSync(localThumbnailPath);
            }
            return { id: "sync-mock-job" };
        }
    };
}

// ONLY instantiate the worker if NOT on Vercel and if a valid Redis client exists
// Background workers cannot run in short-lived serverless functions.
let uploadWorker = null;
if (!process.env.VERCEL && redisClient) {
    console.log("🚀 Starting background BullMQ Upload Worker...");
    uploadWorker = new Worker(
        "video-uploads",
        async (job) => {
            const { videoId, localVideoPath, localThumbnailPath } = job.data;
            console.log(`[Job ${job.id}] Started upload for Video ID: ${videoId}`);

            try {
                // Upload to Cloudinary
                const videoLink = await uploadOnCloudinary(localVideoPath);
                const thumbnailLink = await uploadOnCloudinary(localThumbnailPath);

                if (!videoLink?.url || !thumbnailLink?.url) {
                    throw new Error("Failed to upload to Cloudinary");
                }

                // Update Database
                await Video.findByIdAndUpdate(videoId, {
                    videoFile: videoLink.url,
                    thumbnail: thumbnailLink.url,
                    duration: videoLink.duration || 0,
                    uploadStatus: "completed",
                    isPublished: true,
                });

                console.log(`[Job ${job.id}] Successfully processed Video ID: ${videoId}`);
            } catch (error) {
                console.error(`[Job ${job.id}] Failed processing Video ID: ${videoId}`, error);

                // Mark as failed in DB
                await Video.findByIdAndUpdate(videoId, {
                    uploadStatus: "failed",
                });
                throw error;
            } finally {
                // Cleanup local files safely
                if (localVideoPath && fs.existsSync(localVideoPath)) {
                    fs.unlinkSync(localVideoPath);
                }
                if (localThumbnailPath && fs.existsSync(localThumbnailPath)) {
                    fs.unlinkSync(localThumbnailPath);
                }
            }
        },
        { connection: redisClient }
    );

    uploadWorker.on("completed", (job) => {
        console.log(`[UploadQueue] Job ${job.id} has completed!`);
    });

    uploadWorker.on("failed", (job, err) => {
        console.log(`[UploadQueue] Job ${job.id} has failed with ${err.message}`);
    });
}
