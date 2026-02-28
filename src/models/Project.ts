import mongoose, { Document, Schema } from "mongoose";

export interface IProject extends Document {
  title: string;
  description: string;
  category: string;
  subcategory: string;
  skills: string[];
  budget: { min: number; max: number };
  deliveryDays: number;
  deadline: Date;
  status: "pending" | "open" | "in-progress" | "completed" | "cancelled";
  seller: mongoose.Types.ObjectId;
  bidsCount: number;
  projectType: string;
  posterSkills: string[];
  companyName: string;
  location: string;
  remoteFriendly: boolean;
  urgencyLevel: string;
  attachments: string[];
  workSubmitted: boolean;
  adminConfirmed: boolean;
  ownerConfirmed: boolean;
  createdAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    title:          { type: String, required: true, trim: true },
    description:    { type: String, required: true },
    category:       { type: String, required: true },
    subcategory:    { type: String, default: "" },
    skills:         [{ type: String }],
    budget: {
      min: { type: Number, required: true },
      max: { type: Number, required: true },
    },
    deliveryDays:   { type: Number, default: 0 },
    deadline:       { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "open", "in-progress", "completed", "cancelled"],
      default: "pending",
    },
    seller:         { type: Schema.Types.ObjectId, ref: "User", required: true },
    bidsCount:      { type: Number, default: 0 },
    projectType:    { type: String, enum: ["Fixed Price", "Hourly"], default: "Fixed Price" },
    posterSkills:   [{ type: String }],
    companyName:    { type: String, default: "" },
    location:       { type: String, default: "" },
    remoteFriendly: { type: Boolean, default: true },
    urgencyLevel:   { type: String, enum: ["Normal", "Urgent", "Critical"], default: "Normal" },
    attachments:     [{ type: String }],
    workSubmitted:   { type: Boolean, default: false },
    adminConfirmed:  { type: Boolean, default: false },
    ownerConfirmed:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IProject>("Project", ProjectSchema);
