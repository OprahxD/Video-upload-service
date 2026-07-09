import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    //Check whether user is logged in or not
    //get tweet content from user
    //Send tweet back

    const {content} = req.body || {};

    if(!content || content.trim() === ""){
        throw new ApiError(400,"Content is required");
    }

    const userId = req.user?._id;

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "You need to be logged in to tweet");
    }

    const tweet = await Tweet.create({
        content,
        owner: userId
    });

    if(!tweet){
        throw new ApiError(500,"Something went wrong while creating the tweet");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(201,tweet,"Tweet was created successfully")
    )

})

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    const {userId} = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid User ID format");
    }

    const tweets = await Tweet.aggregate([
        {
            $match:{
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup:{
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "authorDetails",
                pipeline:[
                    {
                        $project:{
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup:{
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "tweetLikes"
            }
        },
        {
            $addFields:{
                author: {
                    $first: "$authorDetails"
                },
                likesCount: {
                    $size: "$tweetLikes"
                }
            }
        },
        {
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                author: 1,
                likesCount: 1
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
        new ApiResponse(200,tweets,"Tweets were fetched successfully")
    )

    

    
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const {content} = req.body;
    if(!content || content.trim() === ""){
        throw new ApiError(400, "Please give content to update");
    }

    const userId = req.user?._id;
    if(!isValidObjectId(userId)){
        throw new ApiError(400,"The user is not logged in");
    }

    const {tweetId} = req.params;

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"Invalid tweet ID format");
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if(tweet.owner.toString() !== userId.toString()){
        throw new ApiError(403, "You donot have permission to edit someone else's tweets");
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
        tweetId,
        {
            $set: {
                content:content
            }
        },
        {
            new: true
        }
    )

    if (!updatedTweet) {
        throw new ApiError(500, "Something went wrong while updating the tweet");
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedTweet, "Tweet updated successfully")
    );

})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet
    const userId = req.user?._id;
    
    if(!isValidObjectId(userId)){
        throw new ApiError(400,"The user is not logged in");
    }


    const {tweetId} = req.params;

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400,"Invalid tweet ID format");
    }

    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    if(tweet.owner.toString() !== userId.toString()){
        throw new ApiError(403, "You donot have permission to edit someone else's tweets");
    }

    await tweet.deleteOne();

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"The tweet was deleted successfully")
    )
})

const getAllTweets = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skipNum = (pageNum - 1) * limitNum;

    const userId = req.user?._id;

    const tweets = await Tweet.aggregate([
        {
            $sort: { createdAt: -1 }
        },
        {
            $skip: skipNum
        },
        {
            $limit: limitNum
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "authorDetails"
            }
        },
        {
            $unwind: "$authorDetails"
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "tweet",
                as: "tweetLikes"
            }
        },
        {
            $addFields: {
                author: {
                    _id: "$authorDetails._id",
                    username: "$authorDetails.username",
                    fullName: "$authorDetails.fullName",
                    avatar: "$authorDetails.avatar"
                },
                likesCount: { $size: "$tweetLikes" },
                isLiked: {
                    $cond: {
                        if: { $in: [new mongoose.Types.ObjectId(userId), "$tweetLikes.likedBy"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                author: 1,
                likesCount: 1,
                isLiked: 1
            }
        }
    ]);

    return res.status(200).json(new ApiResponse(200, tweets, "Tweets fetched successfully"));
});

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet,
    getAllTweets
}