// tests/user.routes.test.js
import request from "supertest";
import { app } from "../src/app.js";
import { User } from "../src/models/user.model.js";
import { connectDB, closeDB, clearDB } from "./db.js";

// --- Database Lifecycle Hooks ---
beforeAll(async () => await connectDB());
afterEach(async () => await clearDB());
afterAll(async () => await closeDB());

describe("User Authentication API", () => {
    
    // We run this setup BEFORE every test to guarantee the user exists in the DB
    beforeEach(async () => {
        const user = new User({
            username: "testuser",
            email: "test@example.com",
            fullName: "Test User",
            password: "password123" // Mongoose pre-save hook will hash this automatically!
        });
        await user.save();
    });

    it("should successfully log in with valid credentials and return tokens", async () => {
        // 1. Act: Fire a fake HTTP request to your Express server
        const response = await request(app)
            .post("/api/v1/users/login") // Update this path if yours is different!
            .send({
                email: "test@example.com",
                password: "password123"
            });

        // 2. Assert: Verify the server responded correctly
        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.username).toBe("testuser");
        
        // 3. Assert: Verify the security cookies were set
        // Express sends cookies in the 'set-cookie' header array
        const cookies = response.headers["set-cookie"];
        expect(cookies).toBeDefined();
        
        // Check if both accessToken and refreshToken were attached
        const hasAccessToken = cookies.some(cookie => cookie.includes("accessToken"));
        const hasRefreshToken = cookies.some(cookie => cookie.includes("refreshToken"));
        
        expect(hasAccessToken).toBe(true);
        expect(hasRefreshToken).toBe(true);
    });

    it("should reject login with an incorrect password", async () => {
        const response = await request(app)
            .post("/api/v1/users/login")
            .send({
                email: "test@example.com",
                password: "wrongpassword"
            });

        // Assuming your ApiError throws a 401 Unauthorized for bad passwords
        expect(response.statusCode).toBe(401); 
    });

});