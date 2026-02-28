import { Router } from "express";
import {
  getUserNotifications,
  markUserAllRead,
  markUserNotificationRead,
} from "../controllers/notification.controller";
import { verifyJWT } from "../middleware/auth";

const router = Router();

router.get("/",               verifyJWT, getUserNotifications);
router.patch("/read-all",     verifyJWT, markUserAllRead);
router.patch("/:id/read",     verifyJWT, markUserNotificationRead);

export default router;
