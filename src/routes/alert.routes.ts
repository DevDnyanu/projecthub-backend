import { Router } from "express";
import { getSavedAlerts, createSavedAlert, deleteSavedAlert } from "../controllers/alert.controller";
import { verifyJWT } from "../middleware/auth";

const router = Router();

router.get("/",       verifyJWT, getSavedAlerts);
router.post("/",      verifyJWT, createSavedAlert);
router.delete("/:id", verifyJWT, deleteSavedAlert);

export default router;
