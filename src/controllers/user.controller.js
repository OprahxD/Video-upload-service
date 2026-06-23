import {asyncHandler} from '../utils/asyncHandler.js';
import {ApiError} from '../utils/Apierror.js';
import {User} from '../models/user.model.js';
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse} from '../utils/Apiresponse.js';

const registerUser = asyncHandler(async(req,res) =>{

  //get user details from front-end
  //validate user details - not empty, valid email, password length, etc
  //check if user already exists - email/username unique
  //checks for avatar image 
  //upload avatar image to cloudinary
  //create new user object - create entry in db
  //remove password and refresh token from user object before sending response to front-end
  //check whether user is created successfully or not
  //return response to front-end with user details 
  
  console.log("--- registerUser Debug Info ---");
  console.log("req.body:", req.body);
  console.log("req.files:", req.files);
  console.log("--------------------------------");

  const {email, username, password, fullName} = req.body || {};
  // console.log("User details from front-end",fullName,email,username,password);

  if(
    [fullName, email, username, password].some((field) => !field || field.trim() === "")
  ){
    throw new ApiError(400, "All fields are required", [
      `Missing fields. Received: fullName='${fullName}', email='${email}', username='${username}', password='${password}'. ` +
      `Content-Type: '${req.headers['content-type']}'. ` +
      `Body keys received: [${Object.keys(req.body || {}).join(", ")}]. ` +
      `Query params received: [${Object.keys(req.query || {}).join(", ")}].`
    ])
  }

  const existedUser = await User.findOne({
    $or: [
      {email},
      {username}
    ]
  })

  if(existedUser){
    throw new ApiError(409, "User with email or username already exists", ["email, username are taken"])
  }
  console.log(existedUser);

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage && req.files.coverImage.length > 0 
  ? req.files.coverImage[0].path 
  : "";

  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file is required", ["avatar file is missing"])
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if(!avatar){
   throw new ApiError(400,"Avatar file is required")
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

  if(!createdUser){
    throw new ApiError(500,"Something went wrong while registering the user")
  }
  
  return res.status(201).json(
    new ApiResponse(200,createdUser, "User was created successfully")
  )
  
})


export {registerUser};