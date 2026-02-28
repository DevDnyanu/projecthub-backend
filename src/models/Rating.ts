import mongoose, { Document, Schema } from "mongoose";

export interface IRating extends Document {
  project: mongoose.Types.ObjectId;
  rater: mongoose.Types.ObjectId;  // buyer
  ratee: mongoose.Types.ObjectId;  // seller
  stars: number;
  comment: string;
  createdAt: Date;
}

const RatingSchema = new Schema<IRating>(
  {
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    rater: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ratee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "" },
  },
  { timestamps: true }
);

// One rating per buyer per project
RatingSchema.index({ project: 1, rater: 1 }, { unique: true });

export default mongoose.model<IRating>("Rating", RatingSchema);
