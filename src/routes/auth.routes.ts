import { Router } from "express";
import { register, login, getMe, verifyEmail, resendVerification, forgotPassword, verifyOtp, resetPassword } from "../controllers/auth.controller";
import { verifyJWT } from "../middleware/auth";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", verifyJWT, getMe);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/forgot-password",     forgotPassword);
router.post("/verify-otp",          verifyOtp);
router.post("/reset-password",      resetPassword);

export default router;
