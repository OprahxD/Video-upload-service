// tests/user.model.test.js
import mongoose from "mongoose";
import { User } from "../src/models/user.model.js";
import { connectDB, closeDB, clearDB } from "./db.js";

// --- JEST LIFECYCLE HOOKS ---
beforeAll(async () => await connectDB());    // Start DB before tests begin
afterEach(async () => await clearDB());      // Wipe DB clean after EVERY test
afterAll(async () => await closeDB());       // Shut DB down when finished

describe("User Model Tests", () => {
    
    it("should successfully create and save a new user", async () => {
        // 1. Arrange: Create the dummy data
        const validUserData = {
            username: "johndoe",
            email: "john@example.com",
            fullName: "John Doe",
            password: "securePassword123"
        };

        // 2. Act: Save it to the in-memory database
        const validUser = new User(validUserData);
        const savedUser = await validUser.save();

        // 3. Assert: Verify Mongoose did its job
        expect(savedUser._id).toBeDefined();
        expect(savedUser.username).toBe("johndoe");
        expect(savedUser.password).not.toBe("securePassword123"); 
        // ^ If you set up a bcrypt 'pre-save' hook in your model, the password should be hashed!
    });

});