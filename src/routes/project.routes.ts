import { Router } from "express";
import { getProjects, getProjectById, createProject, submitWork, markProjectComplete, ownerConfirmComplete } from "../controllers/project.controller";
import { placeBid, getBidsForProject } from "../controllers/bid.controller";
import { buyProject } from "../controllers/purchase.controller";
import { verifyJWT } from "../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const attachmentUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only images and PDFs are allowed"));
  },
});

const router = Router();

router.get("/", getProjects);
router.get("/:id", verifyJWT, getProjectById);
router.post("/", verifyJWT, attachmentUpload.array("attachments", 5), createProject);

router.get("/:id/bids", verifyJWT, getBidsForProject);
router.post("/:id/bids", verifyJWT, placeBid);
router.patch("/:id/submit-work", verifyJWT, submitWork);
router.patch("/:id/confirm-complete", verifyJWT, ownerConfirmComplete);
router.patch("/:id/complete", verifyJWT, markProjectComplete);

router.post("/:id/buy", verifyJWT, buyProject);

export default router;
