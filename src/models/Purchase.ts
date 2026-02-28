import mongoose, { Document, Schema } from "mongoose";

export interface IPurchase extends Document {
  project: mongoose.Types.ObjectId;
  buyer: mongoose.Types.ObjectId;
  freelancer: mongoose.Types.ObjectId;
  amount: number;
  paymentStatus: "pending" | "paid" | "released";
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  paidAt: Date | undefined;
  releasedAt: Date | undefined;
  isRated: boolean;
  createdAt: Date;
}

const PurchaseSchema = new Schema<IPurchase>(
  {
    project:            { type: Schema.Types.ObjectId, ref: "Project", required: true },
    buyer:              { type: Schema.Types.ObjectId, ref: "User",    required: true },
    freelancer:         { type: Schema.Types.ObjectId, ref: "User",    required: true },
    amount:             { type: Number, required: true, min: 1 },
    paymentStatus:      { type: String, enum: ["pending", "paid", "released"], default: "pending" },
    razorpayOrderId:    { type: String, default: "" },
    razorpayPaymentId:  { type: String, default: "" },
    razorpaySignature:  { type: String, default: "" },
    paidAt:             { type: Date },
    releasedAt:         { type: Date },
    isRated:            { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One purchase per user per project
PurchaseSchema.index({ project: 1, buyer: 1 }, { unique: true });

export default mongoose.model<IPurchase>("Purchase", PurchaseSchema);
