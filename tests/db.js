// tests/db.js
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer;

export const connectDB = async () => {
    // 1. Disconnect any existing connections first
    await mongoose.disconnect();
    
    // 2. Spin up the temporary database in RAM
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // 3. Connect Mongoose to this temporary URI
    await mongoose.connect(mongoUri);
};

export const closeDB = async () => {
    // Drop the database, close the connection, and stop the server
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    if (mongoServer) {
        await mongoServer.stop();
    }
};

export const clearDB = async () => {
    // Wipe all collections clean (used between individual tests)
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
};