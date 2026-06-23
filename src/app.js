import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();  

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
})); 

app.use(express.json({
  limit: '16kb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '16kb'
}))

app.use(express.static('public'));
app.use(cookieParser());

// routes import
import userRouter from './routes/user.routes.js';

// routes declaration
app.use("/api/v1/users", userRouter);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    errors: err.errors || []
  });
});

export {app};