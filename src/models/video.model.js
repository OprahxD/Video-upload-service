import mongoose from 'mongoose';
import mongooseAggregatePaginate from 'mongoose-aggregate-paginate-v2';

const videoSchema = new mongoose.Schema({
  videoFile: {
    type: String, //cloudinary url
    required: false
  },
  thumbnail: {
    type: String, //cloudinary url
    required: false
  },
  uploadStatus: {
    type: String,
    enum: ["processing", "completed", "failed"],
    default: "processing"
  },
  title: {
    type: String, 
    required: true
  },
  description: {
    type: String,
    required: false
  },
  duration: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
},{timestamps: true});

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);