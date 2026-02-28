import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Notification from "../models/Notification";

// GET /api/notifications — current user's own notifications
export const getUserNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ recipientId: req.user!._id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/notifications/read-all
export const markUserAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany(
      { recipientId: req.user!._id, read: false },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/notifications/:id/read
export const markUserNotificationRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user!._id },
      { read: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
