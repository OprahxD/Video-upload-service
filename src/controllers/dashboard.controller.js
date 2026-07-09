import mongoose, { isValidObjectId } from "mongoose"
import { Video } from "../models/video.model.js"
import { Subscription } from "../models/subscription.model.js"
import { Like } from "../models/like.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { redis } from "../db/redis.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const channelId = req.user?._id;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const redisKey = `channelStats:${channelId}`;
    const cachedStats = await redis.get(redisKey);

    if (cachedStats) {
        return res.status(200).json(new ApiResponse(200, JSON.parse(cachedStats), "Channel stats fetched successfully from cache"));
    }

    const videoStats = await Video.aggregate([
        { $match: { owner: new mongoose.Types.ObjectId(channelId) } },
        { $group: { _id: null, totalVideos: { $sum: 1 }, totalViews: { $sum: "$views" } } }
    ]);

    const subscriberStats = await Subscription.aggregate([
        { $match: { channel: new mongoose.Types.ObjectId(channelId) } },
        { $group: { _id: null, totalSubscribers: { $sum: 1 } } }
    ]);

    const likesStats = await Like.aggregate([
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videoDetails"
            }
        },
        {
             $unwind: "$videoDetails" 
        },
        {
             $match: { "videoDetails.owner": new mongoose.Types.ObjectId(channelId) } 
        },
        {
             $group: { _id: null, totalLikes: { $sum: 1 } } 
        }
    ]);

    const stats = {
        totalVideos: videoStats[0]?.totalVideos || 0,
        totalViews: videoStats[0]?.totalViews || 0,
        totalSubscribers: subscriberStats[0]?.totalSubscribers || 0,
        totalLikes: likesStats[0]?.totalLikes || 0
    };

    // Cache the result for 5 minutes (300 seconds)
    await redis.setex(redisKey, 300, JSON.stringify(stats));

    return res.status(200).json(new ApiResponse(200, stats, "Channel stats fetched successfully"));
})

const getChannelVideos = asyncHandler(async (req, res) => {
    // TODO: Get all the videos uploaded by the channel
    const channelId = req.user?._id;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const videos = await Video.find({ owner: channelId });

    return res.status(200).json(new ApiResponse(200, videos, "Channel videos fetched successfully"));
})

export {
    getChannelStats,
    getChannelVideos
}