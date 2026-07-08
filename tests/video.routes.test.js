// tests/video.routes.test.js
import request from "supertest";
import { app } from "../src/app.js";
import { Video } from "../src/models/video.model.js";
import { User } from "../src/models/user.model.js";
import { connectDB, closeDB, clearDB } from "./db.js";

beforeAll(async () => await connectDB());
afterEach(async () => await clearDB());
afterAll(async () => await closeDB());

describe("GET /api/v1/videos", () => {
    let ownerId;
    let accessToken;

    // --- SETUP: Seed the database before every test ---
    beforeEach(async () => {
        // 1. Create a dummy owner (because your aggregate pipeline looks up the owner!)
        const user = new User({
            username: "videocreator",
            email: "creator@example.com",
            fullName: "Video Creator",
            password: "password123"
        });
        const savedUser = await user.save();
        ownerId = savedUser._id;
        accessToken = savedUser.generateAccessToken();

        // 2. Generate 15 dummy published videos
        const videosToInsert = [];
        for (let i = 1; i <= 15; i++) {
            videosToInsert.push({
                videoFile: `http://example.com/video${i}.mp4`,
                thumbnail: `http://example.com/thumb${i}.jpg`,
                title: `Test Video ${i}`,
                description: `This is the description for test video ${i}`,
                duration: 120,
                views: 0,
                isPublished: true, // Must be true to pass your $match stage
                owner: ownerId
            });
        }
        
        // Use insertMany to rapidly dump all 15 into the memory database
        await Video.insertMany(videosToInsert);

        // 3. Add 1 UNPUBLISHED video to prove your filter works
        await Video.create({
            videoFile: "http://example.com/hidden.mp4",
            thumbnail: "http://example.com/hidden.jpg",
            title: "Secret Draft Video",
            description: "Do not show this",
            duration: 60,
            isPublished: false,
            owner: ownerId
        });
    });

    // --- THE TESTS ---

    it("should return exactly 10 videos on page 1 with correct pagination math", async () => {
        // Act: Request page 1
        const response = await request(app)
            .get("/api/v1/videos?page=1&limit=10")
            .set('Cookie', [`accessToken=${accessToken}`]);

        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        
        const data = response.body.data;
        
        // Assert: Prove the plugin sliced the array perfectly
        expect(data.docs.length).toBe(10);
        
        // Assert: Prove it ignored the unpublished video (15 total, not 16)
        expect(data.totalDocs).toBe(15); 
        
        // Assert: Prove the frontend booleans are correct
        expect(data.hasNextPage).toBe(true);
        expect(data.hasPrevPage).toBe(false);
        expect(data.totalPages).toBe(2);
    });

    it("should return the remaining 5 videos on page 2", async () => {
        // Act: Request page 2
        const response = await request(app)
            .get("/api/v1/videos?page=2&limit=10")
            .set('Cookie', [`accessToken=${accessToken}`]);

        expect(response.statusCode).toBe(200);
        
        const data = response.body.data;
        
        // Assert: It should only grab the leftovers
        expect(data.docs.length).toBe(5);
        expect(data.hasNextPage).toBe(false);
        expect(data.hasPrevPage).toBe(true);
    });

    it("should accurately filter videos using the search query", async () => {
        // Act: Search for a specific title using the URL query
        const response = await request(app)
            .get("/api/v1/videos?query=Test Video 7")
            .set('Cookie', [`accessToken=${accessToken}`]);

        expect(response.statusCode).toBe(200);
        
        const data = response.body.data;
        
        // Assert: It should only find 1 video, and the title must match
        expect(data.docs.length).toBe(1);
        expect(data.docs[0].title).toBe("Test Video 7");
    });
});