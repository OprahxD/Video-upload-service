// Upload Queue — Synchronous processing (BullMQ removed)
// Uploads are processed inline when publishAVideo is called.
// This is serverless-compatible and works on both Vercel and local dev.

import { Video } from "../models/video.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import fs from "fs";

export const uploadQueue = {
    add: async (name, data) => {
        console.log(`[UploadQueue] Processing job '${name}' synchronously...`);
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
            console.log(`[UploadQueue] Successfully processed Video ID: ${videoId}`);
        } catch (error) {
            console.error(`[UploadQueue] Failed processing Video ID: ${videoId}`, error);
            await Video.findByIdAndUpdate(videoId, { uploadStatus: "failed" });
        } finally {
            if (localVideoPath && fs.existsSync(localVideoPath)) fs.unlinkSync(localVideoPath);
            if (localThumbnailPath && fs.existsSync(localThumbnailPath)) fs.unlinkSync(localThumbnailPath);
        }
        return { id: "sync-job" };
    }
};
