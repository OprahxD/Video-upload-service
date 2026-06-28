import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/Apierror.js';
import { User } from '../models/user.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/Apiresponse.js';
import jwt from "jsonwebtoken";

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
  // console.log("User details from front-end",fullName,email,username,password);

  if (
    [fullName, email, username, password].some((field) => !field || field.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required", [
      `Missing fields. Received: fullName='${fullName}', email='${email}', username='${username}', password='${password}'. ` +
      `Content-Type: '${req.headers['content-type']}'. ` +
      `Body keys received: [${Object.keys(req.body || {}).join(", ")}]. ` +
      `Query params received: [${Object.keys(req.query || {}).join(", ")}].`
    ])
  }

  const existedUser = await User.findOne({
    $or: [
      { email },
      { username }
    ]
  })

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists", ["email, username are taken"])
  }
  console.log(existedUser);

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage && req.files.coverImage.length > 0
    ? req.files.coverImage[0].path
    : "";

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required", ["avatar file is missing"])
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
    new ApiResponse(200, createdUser, "User was created successfully")
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
    secure: true
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
    secure: true
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
      secure: true
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
        


      }
    }
  ])

  if(!channel?.length){
    throw new ApiError(404,"Channel does not exist");
  }

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
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
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