import { Router } from 'express';
import { loginUser,
         googleLogin,
         logoutUser, 
         registerUser, 
         refreshAccessToken, 
         changeCurrentPassword, 
         getCurrentUser, 
         updateAccountDetails, 
         updateUserAvatar, 
         updateUserCoverImage, 
         getUserChannelProfile, 
         getWatchHistory } 
from '../controllers/user.controller.js';
import { upload } from '../middlewares/multer.middleware.js';
import { verifyJWT, optionallyVerifyJWT } from '../middlewares/auth.middleware.js';
import { authLimiter } from '../middlewares/rateLimiter.middleware.js';


const router = Router();

router.route("/register").post(
  authLimiter,
  upload.fields([
    {
      name: 'avatar',
      maxCount: 1
    },
    {   
      name: 'coverImage',
      maxCount: 1
    }
  ]),
  registerUser);


router.route("/login").post(authLimiter, loginUser);
router.route("/google-login").post(authLimiter, googleLogin);

//secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/get-current-user").get(verifyJWT, getCurrentUser);
router.route("/update-account-details").patch(verifyJWT, updateAccountDetails);
router.route("/change-avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/change-cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage);

router.route("/c/:username").get(optionallyVerifyJWT, getUserChannelProfile);
router.route("/history").get(verifyJWT, getWatchHistory);

export default router;