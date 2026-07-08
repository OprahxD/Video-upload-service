// tests/app.test.js
import request from "supertest";
import { app } from "../src/app.js";

describe("Backend Infrastructure Tests", () => {
    
    it("should return 200 for an existing route", async () => {
        // 1. Arrange & Act: Send a GET request to a fake route
        const response = await request(app).get("/api/v1/healthcheck");
        
        // 2. Assert: Verify the server caught it properly
        expect(response.statusCode).toBe(200);
    });

});