// Serverless-safe upload queue
// On Vercel (serverless), uploads are processed synchronously (inline).
// On local/traditional servers, BullMQ + Redis is used for background processing.

import { Video } from "../models/video.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";

export let uploadQueue;
let uploadWorker = null;

const isVercel = !!process.env.VERCEL;

if (!isVercel) {
    // Only import BullMQ and Redis on non-Vercel environments
    // Dynamic import prevents the heavy native modules from loading on serverless
    try {
        const { Queue, Worker } = await import("bullmq");
        const { redisClient } = await import("../db/redis.js");

        if (redisClient) {
            console.log("🚀 Starting background BullMQ Upload Worker...");
            uploadQueue = new Queue("video-uploads", { connection: redisClient });

            uploadWorker = new Worker(
                "video-uploads",
                async (job) => {
                    const { videoId, localVideoPath, localThumbnailPath } = job.data;
                    console.log(`[Job ${job.id}] Started upload for Video ID: ${videoId}`);

                    try {
                        const videoLink = await uploadOnCloudinary(localVideoPath);
                        const thumbnailLink = await uploadOnCloudinary(localThumbnailPath);

                        if (!videoLink?.url || !thumbnailLink?.url) {
                            throw new Error("Failed to upload to Cloudinary");
                        }

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
                        await Video.findByIdAndUpdate(videoId, { uploadStatus: "failed" });
                        throw error;
                    } finally {
                        if (localVideoPath && fs.existsSync(localVideoPath)) fs.unlinkSync(localVideoPath);
                        if (localThumbnailPath && fs.existsSync(localThumbnailPath)) fs.unlinkSync(localThumbnailPath);
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
        } else {
            console.warn("⚠️ Redis not available. Using synchronous upload fallback.");
            uploadQueue = null; // Will be set to mock below
        }
    } catch (err) {
        console.error("⚠️ BullMQ/Redis initialization failed:", err.message);
        uploadQueue = null; // Will be set to mock below
    }
}

// Mock queue fallback — used on Vercel OR when Redis/BullMQ isn't available
if (!uploadQueue) {
    console.warn("⚠️ Using synchronous upload queue (no BullMQ).");
    uploadQueue = {
        add: async (name, data) => {
            console.log(`[SyncQueue] Running job '${name}' synchronously...`);
            const { videoId, localVideoPath, localThumbnailPath } = data;
            try {
                const videoLink = await uploadOnCloudinary(localVideoPath);
                const thumbnailLink = await uploadOnCloudinary(localThumbnailPath);

                if (!videoLink?.url || !thumbnailLink?.url) {
                    throw new Error("Failed to upload to Cloudinary");
                }

                await Video.findByIdAndUpdate(videoId, {
                    videoFile: videoLink.url,
                    thumbnail: thumbnailLink.url,
                    duration: videoLink.duration || 0,
                    uploadStatus: "completed",
                    isPublished: true,
                });
                console.log(`[SyncQueue] Successfully processed Video ID: ${videoId}`);
            } catch (error) {
                console.error(`[SyncQueue] Failed processing Video ID: ${videoId}`, error);
                await Video.findByIdAndUpdate(videoId, { uploadStatus: "failed" });
            } finally {
                if (localVideoPath && fs.existsSync(localVideoPath)) fs.unlinkSync(localVideoPath);
                if (localThumbnailPath && fs.existsSync(localThumbnailPath)) fs.unlinkSync(localThumbnailPath);
            }
            return { id: "sync-job" };
        }
    };
}
