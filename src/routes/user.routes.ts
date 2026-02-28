import { Router } from "express";
import { uploadAvatar, getUserProfile, updateProfile, searchUsers, changePassword } from "../controllers/user.controller";
import { getMyPostedProjects, getMyPurchases, getMyAssignedProjects } from "../controllers/project.controller";
import { verifyJWT } from "../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

// Store temp uploads locally before sending to Cloudinary
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG and WebP images are allowed"));
    }
  },
});

const router = Router();

router.patch("/me/avatar",           verifyJWT, upload.single("avatar"), uploadAvatar);
router.patch("/me/profile",          verifyJWT, updateProfile);
router.patch("/me/change-password",  verifyJWT, changePassword);
router.get("/me/posted", verifyJWT, getMyPostedProjects);
router.get("/me/assigned", verifyJWT, getMyAssignedProjects);
router.get("/me/purchases", verifyJWT, getMyPurchases);
router.get("/search", searchUsers);   // must be BEFORE /:id
router.get("/:id", getUserProfile);

export default router;
