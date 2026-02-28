import { Router } from "express";
import { createOrder, verifyPayment, webhookHandler, getPaymentStatus } from "../controllers/payment.controller";
import { verifyJWT } from "../middleware/auth";

const router = Router();

// Webhook: Razorpay server → our server (no JWT, verified via HMAC signature)
router.post("/webhook", webhookHandler);

// Authenticated routes
router.post("/create-order", verifyJWT, createOrder);
router.post("/verify",       verifyJWT, verifyPayment);
router.get("/status/:projectId", verifyJWT, getPaymentStatus);

export default router;
