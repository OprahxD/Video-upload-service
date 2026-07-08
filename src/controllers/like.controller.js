import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    //TODO: toggle like on video
    const {videoId} = req.params

    if(!videoId){
        throw new ApiError(400,"Couldn't find the required video");
    }

    const userId = req.user?._id;

    if(!userId){
        throw new ApiError(400, "You have to be logged in to like");
    }

    const alreadyLiked = await Like.findOne({
        video: videoId,
        likedBy: userId
    })

    if(alreadyLiked){
        await alreadyLiked.deleteOne();

        return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: false }, "Video unliked successfully")
        );
    }

    const newLike = await Like.create({
        video:videoId,
        likedBy:userId
    })

    if (!newLike) {
        throw new ApiError(500, "Something went wrong while executing the like action");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(201, { isLiked: true }, "Video liked successfully")
    );
})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment
    if(!commentId){
        throw new ApiError(400,"Couldn't find the required comment");
    }

    const userId = req.user?._id;

    if(!userId){
        throw new ApiError(400, "You have to be logged in to like");
    }

    const alreadyLiked = await Like.findOne({
        comment: commentId,
        likedBy: userId
    })

    if(alreadyLiked){
        await alreadyLiked.deleteOne();

        return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: false }, "Comment unliked successfully")
        );
    }

    const newLike = await Like.create({
        comment: commentId,
        likedBy: userId
    })

    if (!newLike) {
        throw new ApiError(500, "Something went wrong while executing the like action");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(201, { isLiked: true }, "Comment liked successfully")
    );

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    if(!tweetId){
        throw new ApiError(400,"Couldn't find the required Tweet");
    }

    const userId = req.user?._id;

    if(!userId){
        throw new ApiError(400, "You have to be logged in to like");
    }

    const alreadyLiked = await Like.findOne({
        tweet: tweetId,
        likedBy: userId
    })

    if(alreadyLiked){
        await alreadyLiked.deleteOne();

        return res
        .status(200)
        .json(
            new ApiResponse(200, { isLiked: false }, "Tweet unliked successfully")
        );
    }

    const newLike = await Like.create({
        tweet: tweetId,
        likedBy: userId
    })

    if (!newLike) {
        throw new ApiError(500, "Something went wrong while executing the like action");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(201, { isLiked: true }, "Tweet liked successfully")
    );
}
)

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const userId = req.user?._id;

    if(!isValidObjectId(userId)){
        throw new ApiError(400,"The user is not logged in");
    }

    const likedVideos = await Like.aggregate([
        {
            $match: {
                likedBy: new mongoose.Types.ObjectId(userId),
                video: { $exists: true, $ne: null }
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "videoDetails",
                
            }
        },
        {
            $unwind: "$videoDetails"
        },
        {
            $project: {
                _id: "$videoDetails._id",
                videoFile: "$videoDetails.videoFile",
                thumbnail: "$videoDetails.thumbnail",
                title: "$videoDetails.title",
                duration: "$videoDetails.duration",
                views: "$videoDetails.views",
                createdAt: "$videoDetails.createdAt"
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        }
    ]);

    return res
    .status(200)
    .json(
        new ApiResponse(200,likedVideos,"likedVideos fetched successfully")
    )
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}