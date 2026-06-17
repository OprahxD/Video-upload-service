// require("dotenv").config({ path: './env' });
import dotenv from "dotenv";
import mongoose from "mongoose";  
import { DB_NAME } from "./constants.js";
import connectDB from "./db/index.js";


dotenv.config({
  path: './.env'
})

connectDB()
.then(()=>{
  app.listen(process.env.PORT || 8000,()=>{
    console.log(`Server is running on port ${process.env.PORT || 8000}`);
  });

  app.on("error",(err)=>{
    console.error("ERROR",err);
    throw err;
  })
})
.catch((err)=>{
  console.error("ERROR",err);
});



























// import express from "express";
// const app = express();



// ;(async() => {
//   try{
//     await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
//     app.on("error",()=>{
//       console.error("ERROR:",err);
//       throw err;
//     })

//     app.listen(process.env.PORT,()=>{
//       console.log(`Server is running on port ${process.env.PORT}`);
//     })
//   }catch(err){
//     console.error("ERROR",err);
//     throw err;
//   }
// })()