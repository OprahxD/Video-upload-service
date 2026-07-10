# ARCHIVE.ONE Backend Engine

A high-performance, serverless-optimized Node.js & Express API powering the **ARCHIVE.ONE** creator platform. Built with MongoDB, Redis caching, JWT authentication, and secure media processing.

## 🛠️ Tech Stack & Architecture

- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **Framework**: Express.js
- **Database**: MongoDB Atlas with Mongoose ODM
- **Caching & Eviction**: Redis (via `ioredis`)
- **Media Storage**: Cloudinary (integrated via `multer` file streams)
- **Deployment**: Vercel Serverless Functions

---

## 🚀 Key Implementations & Enhancements

### 1. Robust Serverless Bootstrapping (Vercel)
- Refactored server entry to `api/index.js` to run natively as a serverless wrapper around the Express instance.
- Configured modern, zero-config Vercel routing (`vercel.json`) using rewrites instead of overriding the build environment.

### 2. High-Resilience Connection Logic
- **Database (MongoDB)**: Configured Mongoose to disable command buffering (`bufferCommands: false`) and set a fast-failing connection timeout (`serverSelectionTimeoutMS: 5000`). This prevents serverless requests from hanging on cold starts if MongoDB Atlas is temporarily unreachable or whitelists are misconfigured.
- **Cache (Redis)**: Created an automatic mock fallback wrapper. If `REDIS_URL` is missing or unreachable, the API gracefully degrades and redirects requests to a dummy wrapper (returning default/empty caches) rather than crashing or freezing the Event Loop.

### 3. Cross-Origin Credentials & Session Caching
- Configured dynamic cookie settings tailored for cross-site environments. When running in production, cookies (`accessToken` and `refreshToken`) are emitted with `SameSite=None` and `Secure=true` attributes to allow secure authentication between different Vercel domains.
- Standardized CORS origin reflection policies to automatically support local development origins alongside dynamic Vercel branch/preview URLs.

### 4. Advanced Controller Systems
- **Google OAuth**: Integrated server-side JWT verification for Google Sign-In using the `google-auth-library` to automatically register or authenticate users.
- **Double-View Prevention**: Built an "exact-once" view incrementing system utilizing MongoDB aggregate query optimizations to stop views from inflating on simple interactions (like liking or unsubscribing).
- **Graceful Media Uploads**: Enforced `secure: true` in Cloudinary configurations to mandate HTTPS media generation across all new video, avatar, and cover image uploads.

---

## 🔑 Environment Variables (`.env`)

```ini
PORT=8000
MONGODB_URI=your_mongodb_connection_string
ACCESS_TOKEN_SECRET=your_jwt_access_secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your_jwt_refresh_secret
REFRESH_TOKEN_EXPIRY=10d
CORS_ORIGIN=https://video-upload-service-frontend.vercel.app

# Cloudinary Config
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Google Authentication
GOOGLE_CLIENT_ID=your_google_client_id

# Redis (Optional: defaults to safe Mock mode if left blank)
REDIS_URL=your_redis_connection_url
```

---

## 🏃 Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (uses `nodemon` & `dotenv`):
   ```bash
   npm run dev
   ```
3. Run test suites:
   ```bash
   npm test
   ```
