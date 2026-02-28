import { Router } from "express";
import { submitRating, checkRating, getUserRatings } from "../controllers/rating.controller";
import { verifyJWT } from "../middleware/auth";

const router = Router();

router.post("/", verifyJWT, submitRating);
router.get("/check/:projectId", verifyJWT, checkRating);
router.get("/:userId", verifyJWT, getUserRatings);

export default router;
