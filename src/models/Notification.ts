import mongoose, { Document, Schema } from "mongoose";

export type NotificationType =
  | "new_bid"
  | "new_project"
  | "bid_accepted"
  | "bid_rejected"
  | "bid_approved_admin"
  | "bid_rejected_admin"
  | "project_completed"
  | "work_submitted"
  | "payment_received"
  | "payment_released"
  | "payment_pending"
  | "work_confirmed_admin"
  | "work_confirmed_owner";

export interface INotification extends Document {
  type: NotificationType;
  message: string;
  bidId?: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;     // user who triggered the action
  projectTitle: string;
  actorName: string;                    // bidder name OR project poster name
  recipientId?: mongoose.Types.ObjectId; // null = admin-only; set = user-specific
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: ["new_bid", "new_project", "bid_accepted", "bid_rejected", "bid_approved_admin", "bid_rejected_admin", "project_completed", "work_submitted", "payment_received", "payment_released", "payment_pending", "work_confirmed_admin", "work_confirmed_owner"],
      required: true,
    },
    message:      { type: String, required: true },
    bidId:        { type: Schema.Types.ObjectId, ref: "Bid",     required: false },
    projectId:    { type: Schema.Types.ObjectId, ref: "Project", required: true },
    actorId:      { type: Schema.Types.ObjectId, ref: "User",    required: true },
    projectTitle: { type: String, required: true },
    actorName:    { type: String, required: true },
    recipientId:  { type: Schema.Types.ObjectId, ref: "User",    required: false, default: null },
    read:         { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Fast per-user queries
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, read: 1 });

export default mongoose.model<INotification>("Notification", NotificationSchema);
