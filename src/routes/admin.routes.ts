import { Router } from "express";
import {
  approveProject,
  rejectProject,
  completeProject,
  getStats,
  getAnalytics,
  getCategories,
  getAllProjects,
  getAllRatings,
  getAllBids,
  approveBid,
  rejectAdminBid,
  getAllPayments,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/admin.controller";
import { verifyJWT } from "../middleware/auth";
import { requireAdmin } from "../middleware/admin";

const router = Router();

// Read-only endpoints — accessible by any logged-in user
router.get("/stats",     verifyJWT, getStats);
router.get("/analytics", verifyJWT, getAnalytics);

// Write + sensitive endpoints — admin only
router.get("/projects",                   verifyJWT, requireAdmin, getAllProjects);
router.patch("/projects/:id/approve",     verifyJWT, requireAdmin, approveProject);
router.patch("/projects/:id/reject",      verifyJWT, requireAdmin, rejectProject);
router.patch("/projects/:id/complete",    verifyJWT, requireAdmin, completeProject);
router.get("/ratings",                    verifyJWT, requireAdmin, getAllRatings);

// Bid management — admin only
router.get("/bids",                verifyJWT, requireAdmin, getAllBids);
router.patch("/bids/:id/approve",  verifyJWT, requireAdmin, approveBid);
router.patch("/bids/:id/reject",   verifyJWT, requireAdmin, rejectAdminBid);

// Payments — admin only
router.get("/payments", verifyJWT, requireAdmin, getAllPayments);

// Notifications — admin only
// NOTE: read-all MUST be defined before /:id/read to avoid Express treating "read-all" as an id
router.get("/notifications",                 verifyJWT, requireAdmin, getNotifications);
router.patch("/notifications/read-all",      verifyJWT, requireAdmin, markAllNotificationsRead);
router.patch("/notifications/:id/read",      verifyJWT, requireAdmin, markNotificationRead);

export default router;
