import { Router } from 'express';
import {
    deleteVideo,
    getAllVideos,
    getVideoById,
    publishAVideo,
    togglePublishStatus,
    updateVideo,
    getVideoUploadStatus,
    getTrendingVideos,
    incrementVideoViews
} from "../controllers/video.controller.js"
import {verifyJWT, optionallyVerifyJWT} from "../middlewares/auth.middleware.js"
import {upload} from "../middlewares/multer.middleware.js"

const router = Router();

// Trending videos (public view)
router.route("/trending/top").get(optionallyVerifyJWT, getTrendingVideos);

router
.route("/")
.get(optionallyVerifyJWT, getAllVideos)
.post(
    verifyJWT,
    upload.fields([
        {
            name: "videoFile",
            maxCount: 1,
        },
        {
            name: "thumbnail",
            maxCount: 1,
        },
    ]),
    publishAVideo
);

router
.route("/:videoId")
.get(optionallyVerifyJWT, getVideoById)
.delete(verifyJWT, deleteVideo)
.patch(verifyJWT, upload.single("thumbnail"), updateVideo);

router.route("/view/:videoId").patch(optionallyVerifyJWT, incrementVideoViews);

router.route("/toggle/publish/:videoId").patch(verifyJWT, togglePublishStatus);
router.route("/status/:videoId").get(verifyJWT, getVideoUploadStatus);

export default router