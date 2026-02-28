import mongoose, { Document, Schema } from "mongoose";

export interface ISavedAlert extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  category: string;
  skills: string[];
  budgetMin?: number;
  budgetMax?: number;
  createdAt: Date;
}

const SavedAlertSchema = new Schema<ISavedAlert>(
  {
    userId:    { type: Schema.Types.ObjectId, ref: "User", required: true },
    name:      { type: String, required: true, trim: true },
    category:  { type: String, default: "" },
    skills:    [{ type: String }],
    budgetMin: { type: Number },
    budgetMax: { type: Number },
  },
  { timestamps: true }
);

SavedAlertSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<ISavedAlert>("SavedAlert", SavedAlertSchema);
