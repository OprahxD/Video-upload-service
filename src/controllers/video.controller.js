import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary, deleteFromCloudinary} from "../utils/cloudinary.js"


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

    const localVideoPath = req.files?.videoFile?.[0]?.path;
    const localThumbnailPath = req.files?.thumbnail?.[0]?.path;

    if(!localVideoPath){
        throw new ApiError(400, "Video file is missing");
    }

    if(!localThumbnailPath){
        throw new ApiError(400, "Thumbnail file is missing");
    }

    const videoLink = await uploadOnCloudinary(localVideoPath);
    const thumbnailLink = await uploadOnCloudinary(localThumbnailPath);

    if(!videoLink?.url){
        throw new ApiError(500, "Error while uploading video to Cloudinary");
    }

    if(!thumbnailLink?.url){
        throw new ApiError(500, "Error while uploading thumbnail to Cloudinary");
    }

    const video = await Video.create({
        title,
        description: finalDescription,
        videoFile: videoLink.url,
        thumbnail: thumbnailLink.url,
        duration: videoLink.duration || 0,
        owner: req.user?._id,
        isPublished: true
    })

    return res.status(201).json(new ApiResponse(201, video, "Video published successfully"));
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: { views: 1 }
        },
        { new: true }
    ).populate("owner", "username fullName avatar");

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    if (req.user?._id) {
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $addToSet: { watchHistory: videoId }
            }
        );
    }

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

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}