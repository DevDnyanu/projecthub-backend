import { Router } from "express";
import { updateBidStatus } from "../controllers/bid.controller";
import { verifyJWT } from "../middleware/auth";

const router = Router();

// PATCH /api/bids/:bidId  — accept or reject a bid (project owner only)
router.patch("/:bidId", verifyJWT, updateBidStatus);

export default router;
