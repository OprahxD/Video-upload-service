import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Couldn't fetch videoId");
    }
    const pageNum = parseInt(page,10);
    const limitNum = parseInt(limit,10);
    const skipNum = (pageNum-1)*limitNum;
    const videoComments = Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
            $sort: {
                createdAt: -1
            }
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
                as: "ownerDetails"

            }
        },
        {
            $unwind: $ownerDetails
        },
        {   
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                owner: {
                    _id: "$ownerDetails._id",
                    username: "$ownerDetails.username",
                    avatar: "$ownerDetails.avatar",
                    fullName: "$ownerDetails.fullName"
                }
            }
        }
    ]);

    return res
    .status(200)
    .json(
        new ApiResponse(200, videoComments, "Video comments fetched successfully")
    );
})

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const {commentContent} = req.body || {};

    if(!commentContent || commentContent.trim() === ''){
        throw new ApiError(400, "Comment wasn't recieved by server");
    }

    const {videoId} = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Couldn't Find the video you are looking for");
    }

    const userId = req.user?._id;

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "You need to be logged in to comment");
    }

    const comment = await Comment.create({
        content: commentContent,
        video: videoId,
        owner: userId
    });

    if(!comment){
        throw new ApiError(500,"Something went wrong while uploading the comment");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(201,comment,"Comment was uploaded successfully")
    )
})

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const {content} = req.body;
    if(!content || content.trim() === ""){
        throw new ApiError(400, "Please give content to update");
    }

    const userId = req.user?._id;
    if(!isValidObjectId(userId)){
        throw new ApiError(400,"The user is not logged in");
    }

    const {commentId} = req.params;

    if(!isValidObjectId(commentId)){
        throw new ApiError(400,"Invalid comment ID format");
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    if(comment.owner.toString() !== userId.toString()){
        throw new ApiError(403, "You donot have permission to edit someone else's comment");
    }

    comment.content = content;
    const updatedComment = await comment.save();

    if (!updatedComment) {
        throw new ApiError(500, "Something went wrong while updating the comment");
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedComment, "comment updated successfully")
    );
})

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const userId = req.user?._id;
        
    if(!isValidObjectId(userId)){
        throw new ApiError(400,"The user is not logged in");
    }


    const {commentId} = req.params;

    if(!isValidObjectId(commentId)){
        throw new ApiError(400,"Invalid comment ID format");
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    if(comment.owner.toString() !== userId.toString()){
        throw new ApiError(403, "You donot have permission to edit someone else's comments");
    }

    await comment.deleteOne();

    return res
    .status(200)
    .json(
        new ApiResponse(200,{},"The comment was deleted successfully")
    )
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }