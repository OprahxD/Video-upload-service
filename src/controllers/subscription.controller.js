import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    // TODO: toggle subscription
    const {channelId} = req.params;

    if(!channelId){
        throw new ApiError(400,"Channel couldn't be fetched");
    }

    const userId = req.user?._id;

    if(!userId){
        throw new ApiError(400,"User needs to be logged in to perform this action");
    }

    const alreadySubscribed = await Subscription.findOne({
        channel:channelId,
        subscriber:userId
    })

    if(alreadySubscribed){
        await alreadySubscribed.deleteOne();

        return res
        .status(200)
        .json(
            new ApiResponse(200, { isSubscribed: false }, "Channel unsubscribed successfully")
        );
    }

    const newSubscription = await Subscription.create({
        channel:channelId,
        subscriber:userId
    });

    if (!newSubscription) {
        throw new ApiError(500, "Something went wrong while executing the subscribe action");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(201, { isSubscribed: true }, "Channel subscribed successfully")
    );

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid Channel ID format");
    }

    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },  
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriberDetails"
            }
        },
        {
            $unwind: "$subscriberDetails"
        },
        {
            $project: {
                _id: "$subscriberDetails._id",
                username: "$subscriberDetails.username",
                avatar: "$subscriberDetails.avatar",
                fullName: "$subscriberDetails.fullName",
                createdAt: "$subscriberDetails.createdAt"
            }
        }
    ]);

    return res
    .status(200)
    .json(
        new ApiResponse(200,subscribers,"Subscriber list was fetched successfully")
    )
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const {subscriberId} = req.params

    if(!isValidObjectId(subscriberId)){
        throw new ApiError(400, "subscriber Id was not fetched properly");
    }

    const channels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channelDetails"
            }
        },
        {
            $unwind: "$channelDetails"
        },
        {
            $project: {
                _id: "$channelDetails._id",
                avatar: "$channelDetails.avatar",
                username: "$channelDetails.username",
                fullName: "$channelDetails.fullName"
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200,channels,"Channels were fetched successfully")
    )
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}