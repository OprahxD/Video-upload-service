import { Router } from 'express';
import {
    createTweet,
    deleteTweet,
    getUserTweets,
    updateTweet,
    getAllTweets
} from "../controllers/tweet.controller.js"
import {verifyJWT, optionallyVerifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/").get(optionallyVerifyJWT, getAllTweets);
router.route("/createTweet").post(verifyJWT, createTweet);
router.route("/user/:userId").get(optionallyVerifyJWT, getUserTweets);
router.route("/:tweetId").patch(verifyJWT, updateTweet).delete(verifyJWT, deleteTweet);


export default router
