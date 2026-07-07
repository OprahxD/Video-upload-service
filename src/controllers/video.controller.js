import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


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
            {title: {regex: query,$options: "i"}},
            {description: {regex: query,$options: "i"}}
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
            $unwind: $ownerDetails
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
    // TODO: get video, upload to cloudinary, create video

    if(!title || title?.trim() === ""){
        throw new ApiError(400, "Title is required")
    }

    if(!description){
        description = "";
    }

    const {localVideoPath} = req.file?.path ;

    if(!localVideoPath){
        throw new ApiError(400,"Avatar is missing");
    }

    const videoLink = await uploadOnCloudinary(localVideoPath);

    if(!videoLink.url){
        throw new ApiError(400, "Error while uploading video");
    }

    const video = await Video.create({
        videoFile: videoLink.url,

    })
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}