import mongoose, { Document, Schema } from "mongoose";

export interface IBid extends Document {
  project: mongoose.Types.ObjectId;
  bidder: mongoose.Types.ObjectId;
  amount: number;
  deliveryDays: number;
  coverLetter: string;
  skills: string[];
  experienceLevel: string;
  yearsOfExperience: number;
  bio: string;
  portfolioUrl: string;
  linkedinUrl: string;
  availability: string;
  status: "pending" | "accepted" | "rejected";
  adminStatus: "pending_admin" | "approved" | "rejected_admin";
  createdAt: Date;
}

const BidSchema = new Schema<IBid>(
  {
    project:           { type: Schema.Types.ObjectId, ref: "Project", required: true },
    bidder:            { type: Schema.Types.ObjectId, ref: "User",    required: true },
    amount:            { type: Number, required: true, min: 1 },
    deliveryDays:      { type: Number, required: true, min: 1 },
    coverLetter:       { type: String, required: true },
    skills:            [{ type: String }],
    experienceLevel:   { type: String, default: "" },
    yearsOfExperience: { type: Number, default: 0 },
    bio:               { type: String, default: "" },
    portfolioUrl:      { type: String, default: "" },
    linkedinUrl:       { type: String, default: "" },
    availability:      { type: String, default: "" },
    status:            { type: String, enum: ["pending", "accepted", "rejected"],              default: "pending"       },
    adminStatus:       { type: String, enum: ["pending_admin", "approved", "rejected_admin"], default: "pending_admin" },
  },
  { timestamps: true }
);

// One bid per user per project
BidSchema.index({ project: 1, bidder: 1 }, { unique: true });

export default mongoose.model<IBid>("Bid", BidSchema);
