import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import fs from 'fs';
import { ApiResponse } from '../utils/ApiResponse.js';
import { redis } from "../db/redis.js";
import jwt from "jsonwebtoken";
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiError(500, "Something went wrong while generating refresh and Access Token ")
  }
}

const registerUser = asyncHandler(async (req, res) => {

  //get user details from front-end
  //validate user details - not empty, valid email, password length, etc
  //check if user already exists - email/username unique
  //checks for avatar image 
  //upload avatar image to cloudinary
  //create new user object - create entry in db
  //remove password and refresh token from user object before sending response to front-end
  //check whether user is created successfully or not
  //return response to front-end with user details 

  // console.log("--- registerUser Debug Info ---");
  // console.log("req.body:", req.body);
  // console.log("req.files:", req.files);
  // console.log("--------------------------------");

  const { email, username, password, fullName } = req.body || {};

  if (
    [fullName, email, username, password].some((field) => !field || field.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage && req.files.coverImage.length > 0
      ? req.files.coverImage[0].path
      : "";
    if (avatarLocalPath) fs.unlinkSync(avatarLocalPath);
    if (coverImageLocalPath) fs.unlinkSync(coverImageLocalPath);
    throw new ApiError(400, "Invalid email format");
  }

  const avatarFile = req.files?.avatar?.[0];
  const avatarLocalPath = avatarFile?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const coverImageLocalPath = req.files?.coverImage && req.files.coverImage.length > 0
    ? req.files.coverImage[0].path
    : "";

  if (avatarFile && !avatarFile.mimetype.startsWith("image/")) {
    if (avatarLocalPath) fs.unlinkSync(avatarLocalPath);
    if (coverImageLocalPath) fs.unlinkSync(coverImageLocalPath);
    throw new ApiError(400, "Avatar file must be an image");
  }

  const coverImageFile = req.files?.coverImage?.[0];
  if (coverImageFile && !coverImageFile.mimetype.startsWith("image/")) {
    if (avatarLocalPath) fs.unlinkSync(avatarLocalPath);
    if (coverImageLocalPath) fs.unlinkSync(coverImageLocalPath);
    throw new ApiError(400, "Cover image file must be an image");
  }

  const existedUser = await User.findOne({
    $or: [
      { email },
      { username }
    ]
  })

  if (existedUser) {
    if (avatarLocalPath) fs.unlinkSync(avatarLocalPath);
    if (coverImageLocalPath) fs.unlinkSync(coverImageLocalPath);
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required")
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  return res.status(201).json(
    new ApiResponse(201, createdUser, "User was created successfully")
  )

})

const loginUser = asyncHandler(async (req, res) => {
  //req-body get username/email and password
  //query if the give username/email exists
  //check if the password is same? jwt token -?
  //if same, return success -> generate access and refresh token
  //send cookie
  //if not same, return wrong password error
  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  }

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser, accessToken, refreshToken
        },
        "User logged in successfully"
      )
    )

})

const googleLogin = asyncHandler(async (req, res) => {
    const { token } = req.body;

    if (!token) {
        throw new ApiError(400, "Google token is missing");
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, picture } = payload; 

        // Check if user already exists
        let user = await User.findOne({ email });

        if (!user) {
            // Create a new user if they don't exist
            const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            let username = baseUsername;
            let counter = 1;
            
            // Ensure username uniqueness
            while (await User.findOne({ username })) {
                username = `${baseUsername}${counter}`;
                counter++;
            }

            user = await User.create({
                fullName: username,
                email: email,
                username: username,
                avatar: picture,
                password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8), 
            });
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

        const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        user: loggedInUser, accessToken, refreshToken
                    },
                    "User logged in successfully with Google"
                )
            );
    } catch (error) {
        console.error("Google Login Error: ", error);
        throw new ApiError(401, "Invalid Google token");
    }
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1 //this removes the field from the document
      }
    }, {
    new: true
  }
  )

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
  }


  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
      new ApiResponse(200, {}, "user logged out")
    );
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  
  if(!incomingRefreshToken){
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )
  
    const user = await User.findById(decodedToken?._id);
  
    if(!user){
      throw new ApiError(401,"Invalid refresh token");
    }
  
    if(incomingRefreshToken !== user?.refreshToken){
      throw new ApiError(401,"Invalid refresh token(expired/used)");
    }
  
    const options = {
      httpOnly:true,
      secure: process.env.NODE_ENV === "production"
    }
  
    const {accessToken,newrefreshToken} = await generateAccessAndRefreshTokens(user._id);
  
    return res
    .status(200)
    .cookie("accessToken", accessToken)
    .cookie("refreshToken", newrefreshToken)
    .json(
      new ApiError(
        200,
        {accessToken,refreshToken:newrefreshToken},
        "Access Token refreshed"
      )
    )
  } catch (error) {
      throw new ApiError(401, error?.message || "Invalid refresh token");
  }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
  const {oldPassword, newPassword} = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if(!isPasswordCorrect){
    throw new ApiError(400, "Old password is incorrect");

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password was changed successfully"))
  }
})

const getCurrentUser = asyncHandler(async(req,res)=>{
  return res
  .status(200)
  .json(new ApiResponse(200,req.user,"current user fetched successfully"));
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
  const {fullName,email} = req.body;

  if(!fullName && !email){
    throw new ApiError(400, "All fields are required");
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ApiError(400, "Invalid email format");
    }
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName: fullName,
        email: email
      }
    },
    {new: true}
  ).select("-password");

  return res
  .status(200)
  .json(new ApiResponse(200,user,"Account details updated successfully"));

})

const updateUserAvatar = asyncHandler(async(req,res)=>{
  const avatarLocalPath = req.file?.path;
  if(!avatarLocalPath){
    throw new ApiError(400,"Avatar is missing");
  }

  if (req.file && !req.file.mimetype.startsWith("image/")) {
    fs.unlinkSync(avatarLocalPath);
    throw new ApiError(400, "Avatar file must be an image");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if(!avatar.url){
    throw new ApiError(400, "Error while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar: avatar.url
      }
    },
    {new:true}
  ).select("-password");

  //Add deletion of old picture

  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"Avatar updated successfully")
  )

})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
  const coverImageLocalPath = req.file?.path;
  if(!coverImageLocalPath){
    throw new ApiError(400,"Avatar is missing");
  }

  const coverImage = await uploadOnCloudinary(avatarLocalPath);

  if(!coverImage.url){
    throw new ApiError(400, "Error while uploading avatar");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverImage: coverImage.url
      }
    },
    {new:true}
  ).select("-password");

  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"Cover Image updated successfully")
  )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
  const {username} = req.params;

  if(!username?.trim()){
    throw new ApiError(400,"Username is missing");
  }

  const redisKey = `userProfile:${username.toLowerCase()}`;
  const cachedProfile = await redis.get(redisKey);

  if (cachedProfile) {
    return res.status(200).json(
      new ApiResponse(200, JSON.parse(cachedProfile), "User channel fetched successfully from cache")
    );
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos"
      }
    },
    {
      $lookup: {
        from: "likes",
        localField: "videos._id",
        foreignField: "video",
        as: "likes"
      }
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers"
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo"
        },
        isSubscribed: {
          $cond: {
            if: {$in: [req.user?._id, "$subscribers.subscriber"]},
            then: true,
            else: false
          }
        },
        totalVideos: {
          $size: "$videos"
        },
        totalViews: {
          $sum: "$videos.views"
        },
        totalLikes: {
          $size: "$likes"
        }
      }
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
        totalVideos: 1,
        totalViews: 1,
        totalLikes: 1
      }
    }
  ])

  if(!channel?.length){
    throw new ApiError(404,"Channel does not exist");
  }

  // Cache the profile for 5 minutes (300 seconds)
  await redis.setex(redisKey, 300, JSON.stringify(channel[0]));

  return res
  .status(200)
  .json(
    new ApiResponse(200,channel[0],"User channel fetched successfully")
  )
})

const getWatchHistory = asyncHandler(async(req,res)=>{
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $addFields: {
        watchHistory: {
          $map: {
            input: { $ifNull: ["$watchHistory", []] },
            as: "vh",
            in: { $toObjectId: "$$vh" }
          }
        }
      }
    },
    {
      $lookup: {
        from: "videos",
        let: { history_ids: "$watchHistory" },
        pipeline: [
          {
            $match: {
              $expr: { $in: ["$_id", "$$history_ids"] }
            }
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
            $addFields: {
              owner: { $first: "$ownerDetails" }
            }
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
              createdAt: 1,
              owner: {
                _id: "$owner._id",
                username: "$owner.username",
                fullName: "$owner.fullName",
                avatar: "$owner.avatar"
              }
            }
          }
        ],
        as: "watchHistory"
      }
    }
  ])

  return res
  .status(200)
  .json(new ApiResponse(
    200,
    user[0].watchHistory,
    "watch history fetched successfully"
  ))
})



export {
  registerUser,
  loginUser,
  googleLogin,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
};