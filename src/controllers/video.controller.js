import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js"
import { uploadQueue } from "../queues/uploadQueue.js"
import { redis } from "../db/redis.js"
import fs from 'fs';


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
    const pageNum = parseInt(page,10);
    const limitNum = parseInt(limit,10);
    const skipNum = (page-1)*limit;

    const matchConditions = {
        isPublished: true 
    };

    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid User ID format");
        }
        matchConditions.owner = new mongoose.Types.ObjectId(userId);
    }

    if(query){
        matchConditions.$or = [
            {title: {$regex: query, $options: "i"}},
            {description: {$regex: query, $options: "i"}}
        ]
    }

    const sortConditions = {};
    if(sortBy && sortType){
        sortConditions[sortBy] = sortType = "asc"?1:-1;
    }else{
        sortConditions["createdAt"] = -1;
    }

    const videoAggregate = Video.aggregate([
        {
            $match: matchConditions
        },
        {
            $sort: sortConditions
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails"
            }
        },
        {
            $unwind: "$ownerDetails"
        },
        {
            $project: {
                _id: 1,
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                owner: {
                    _id: "$ownerDetails._id",
                    username: "$ownerDetails.username",
                    fullName: "$ownerDetails.fullName",
                    avatar: "$ownerDetails.avatar"
                }
            }
        }
    ])

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const videos = await Video.aggregatePaginate(videoAggregate,options);
    return res
    .status(200)
    .json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    );
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body

    if(!title || title?.trim() === ""){
        throw new ApiError(400, "Title is required")
    }

    let finalDescription = description;
    if(!finalDescription){
        finalDescription = "";
    }

    const videoFile = req.files?.videoFile?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];
    const localVideoPath = videoFile?.path;
    const localThumbnailPath = thumbnailFile?.path;

    if(!localVideoPath){
        if (localThumbnailPath) fs.unlinkSync(localThumbnailPath);
        throw new ApiError(400, "Video file is missing");
    }

    if(!localThumbnailPath){
        if (localVideoPath) fs.unlinkSync(localVideoPath);
        throw new ApiError(400, "Thumbnail file is missing");
    }

    // Video mimetype check
    if (videoFile && !videoFile.mimetype.startsWith("video/")) {
        if (localVideoPath) fs.unlinkSync(localVideoPath);
        if (localThumbnailPath) fs.unlinkSync(localThumbnailPath);
        throw new ApiError(400, "Uploaded file must be a video file");
    }

    // Thumbnail mimetype check
    if (thumbnailFile && !thumbnailFile.mimetype.startsWith("image/")) {
        if (localVideoPath) fs.unlinkSync(localVideoPath);
        if (localThumbnailPath) fs.unlinkSync(localThumbnailPath);
        throw new ApiError(400, "Thumbnail file must be an image file");
    }

    const video = await Video.create({
        title,
        description: finalDescription,
        owner: req.user?._id,
        uploadStatus: "processing",
        isPublished: false // Will be set to true when upload is complete
    })

    // Enqueue job for background processing
    await uploadQueue.add("video-upload-job", {
        videoId: video._id,
        localVideoPath,
        localThumbnailPath
    });

    return res.status(202).json(new ApiResponse(202, video, "Video upload processing started"));
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID");
    }

    const existingVideo = await Video.findById(videoId);

    if(!existingVideo){
        throw new ApiError(404, "Video not found");
    }

    const userId = req.user?._id;

    const videoAggregate = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId)
            }
        },
        // Lookup owner details
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $unwind: "$owner"
        },
        // Lookup likes count
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        // Lookup subscriptions for owner
        {
            $lookup: {
                from: "subscriptions",
                localField: "owner._id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $addFields: {
                likesCount: { $size: "$likes" },
                isLiked: {
                    $cond: {
                        if: { $in: [new mongoose.Types.ObjectId(userId), "$likes.likedBy"] },
                        then: true,
                        else: false
                    }
                },
                subscribersCount: { $size: "$subscribers" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [new mongoose.Types.ObjectId(userId), "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
                owner: {
                    _id: "$owner._id",
                    username: "$owner.username",
                    fullName: "$owner.fullName",
                    avatar: "$owner.avatar",
                    subscribersCount: "$subscribersCount"
                },
                likesCount: 1,
                isLiked: 1,
                isSubscribed: 1
            }
        }
    ]);

    const video = videoAggregate[0];

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    console.log("getVideoById: req.user =", req.user?._id);
    if (req.user?._id) {
        try {
            const updatedUser = await User.findByIdAndUpdate(
                req.user._id,
                {
                    $addToSet: { watchHistory: new mongoose.Types.ObjectId(videoId) }
                },
                { new: true }
            );
            console.log("Updated user watch history:", updatedUser?.watchHistory);
        } catch (error) {
            console.error("Error updating watch history:", error);
        }
    }

    // Increment trending views in Redis (sorted set)
    await redis.zincrby("trending:videos", 1, videoId);

    return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully"));
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { title, description } = req.body

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID");
    }

    const updateFields = {};
    if(title) updateFields.title = title;
    if(description) updateFields.description = description;
    const localThumbnailPath = req.file?.path;
    if(localThumbnailPath){
        if (req.file && !req.file.mimetype.startsWith("image/")) {
            fs.unlinkSync(localThumbnailPath);
            throw new ApiError(400, "Thumbnail file must be an image file");
        }
        const thumbnailLink = await uploadOnCloudinary(localThumbnailPath);
        if(!thumbnailLink?.url){
            throw new ApiError(500, "Error uploading new thumbnail");
        }
        updateFields.thumbnail = thumbnailLink.url;

        // Optionally, delete the old thumbnail from Cloudinary here
        const oldVideo = await Video.findById(videoId);
        if(oldVideo && oldVideo.thumbnail){
            const oldThumbnailPublicId = oldVideo.thumbnail.split('/').pop().split('.')[0];
            await deleteFromCloudinary(oldThumbnailPublicId, "image");
        }
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $set: updateFields },
        { new: true }
    );

    if(!updatedVideo){
        throw new ApiError(404, "Video not found");
    }

    return res.status(200).json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    if(video.videoFile){
        const videoPublicId = video.videoFile.split('/').pop().split('.')[0];
        await deleteFromCloudinary(videoPublicId, "video");
    }

    if(video.thumbnail){
        const thumbnailPublicId = video.thumbnail.split('/').pop().split('.')[0];
        await deleteFromCloudinary(thumbnailPublicId, "image");
    }

    await Video.findByIdAndDelete(videoId);

    return res.status(200).json(new ApiResponse(200, {}, "Video deleted successfully"));
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    video.isPublished = !video.isPublished;
    await video.save();

    return res.status(200).json(new ApiResponse(200, video, "Video publish status toggled"));
})

const getVideoUploadStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId).select("title uploadStatus isPublished");

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    return res.status(200).json(new ApiResponse(200, video, "Video status fetched successfully"));
})

const getTrendingVideos = asyncHandler(async (req, res) => {
    try {
        // Try getting top 10 video IDs from the sorted set in descending order
        const trendingVideoIds = await redis.zrevrange("trending:videos", 0, 9);
        
        if (trendingVideoIds && trendingVideoIds.length > 0) {
            // Fetch video details from MongoDB, preserving the sorted order
            const videos = await Video.find({ _id: { $in: trendingVideoIds } })
                .populate("owner", "username avatar fullName")
                .select("-videoFile");

            // Sort the fetched videos to match the order of IDs in Redis
            const sortedVideos = trendingVideoIds.map(id => 
                videos.find(video => video._id.toString() === id)
            ).filter(video => video != null);

            return res.status(200).json(new ApiResponse(200, sortedVideos, "Trending videos fetched successfully from Redis"));
        }
    } catch (error) {
        console.error("Redis failed to fetch trending videos, falling back to database:", error);
    }

    // Fallback: Fetch top 10 videos by views directly from the database
    const videos = await Video.find()
        .sort({ views: -1 })
        .limit(10)
        .populate("owner", "username avatar fullName")
        .select("-videoFile");

    return res.status(200).json(new ApiResponse(200, videos, "Trending videos fetched successfully from Database"));
})

const incrementVideoViews = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID");
    }
    const video = await Video.findByIdAndUpdate(
        videoId,
        { $inc: { views: 1 } },
        { new: true }
    );
    if(!video){
        throw new ApiError(404, "Video not found");
    }
    // Increment trending views in Redis (sorted set)
    await redis.zincrby("trending:videos", 1, videoId);

    return res.status(200).json(new ApiResponse(200, { views: video.views }, "Video view incremented"));
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    getVideoUploadStatus,
    getTrendingVideos,
    incrementVideoViews
}