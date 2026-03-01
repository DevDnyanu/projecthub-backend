import Razorpay from "razorpay";
import crypto from "crypto";
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Bid from "../models/Bid";
import Project from "../models/Project";
import Purchase from "../models/Purchase";
import User from "../models/User";
import Notification from "../models/Notification";

const getRazorpay = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

// POST /api/payments/create-order
// Client calls this after accepting a bid to get a Razorpay order ID
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      res.status(400).json({ message: "projectId is required" });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Only the project owner (client) can initiate payment
    if (project.seller.toString() !== req.user!._id.toString()) {
      res.status(403).json({ message: "Only the project owner can initiate payment" });
      return;
    }

    // Project must be completed (admin verified) with an accepted bid (not yet paid)
    if (project.status !== "completed") {
      res.status(400).json({ message: "Project must be marked complete by admin before payment" });
      return;
    }

    const acceptedBid = await Bid.findOne({ project: projectId, status: "accepted" });
    if (!acceptedBid) {
      res.status(400).json({ message: "No accepted bid found. Accept a bid first." });
      return;
    }

    // Check if already paid (idempotency)
    const existingPurchase = await Purchase.findOne({ project: projectId, buyer: req.user!._id });
    if (existingPurchase && existingPurchase.paymentStatus === "paid") {
      res.status(409).json({ message: "Payment already completed for this project" });
      return;
    }

    const razorpay = getRazorpay();
    const amountInPaise = Math.round(acceptedBid.amount * 100);

    console.log(`[Payment] Creating order | amount: ₹${acceptedBid.amount} (${amountInPaise} paise) | key: ${process.env.RAZORPAY_KEY_ID}`);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now().toString().slice(-10)}`,
      notes: {
        projectId: projectId.toString(),
        bidId: acceptedBid._id.toString(),
        buyerId: req.user!._id.toString(),
        freelancerId: acceptedBid.bidder.toString(),
      },
    });

    console.log(`[Payment] Order created: ${order.id} | status: ${order.status}`);

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("createOrder error:", error);
    res.status(500).json({ message: "Failed to create payment order", error });
  }
};

// POST /api/payments/verify
// Called by frontend after Razorpay checkout completes to verify signature and activate project
export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, projectId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !projectId) {
      res.status(400).json({ message: "Missing required payment fields" });
      return;
    }

    // Verify HMAC-SHA256 signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      res.status(400).json({ message: "Payment verification failed: invalid signature" });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const acceptedBid = await Bid.findOne({ project: projectId, status: "accepted" });
    if (!acceptedBid) {
      res.status(400).json({ message: "No accepted bid found for this project" });
      return;
    }

    // Upsert purchase record with payment details
    const purchase = await Purchase.findOneAndUpdate(
      { project: projectId, buyer: req.user!._id },
      {
        project: projectId,
        buyer: req.user!._id,
        freelancer: acceptedBid.bidder,
        amount: acceptedBid.amount,
        paymentStatus: "paid",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paidAt: new Date(),
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Notify the freelancer that payment has been received
    const buyerUser = await User.findById(req.user!._id).select("name");
    await Notification.create({
      type: "payment_received",
      message: `Payment of ₹${acceptedBid.amount.toLocaleString("en-IN")} has been released for "${project.title}". Thank you!`,
      projectId: project._id,
      actorId: req.user!._id,
      projectTitle: project.title,
      actorName: buyerUser?.name || "",
      recipientId: acceptedBid.bidder,
    });

    res.json({ message: "Payment verified successfully", purchase });
  } catch (error) {
    console.error("verifyPayment error:", error);
    res.status(500).json({ message: "Payment verification error", error });
  }
};

// POST /api/payments/webhook
// Razorpay server-to-server webhook (backup, handles edge cases)
export const webhookHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      res.json({ status: "ok" }); // No webhook secret configured, skip
      return;
    }

    const signature = req.headers["x-razorpay-signature"] as string;
    const rawBody = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      res.status(400).json({ message: "Invalid webhook signature" });
      return;
    }

    const event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (!payment) { res.json({ status: "ok" }); return; }

      const notes = payment.notes || {};
      const { projectId, bidId, buyerId } = notes;

      if (projectId && bidId && buyerId) {
        // Idempotent: only process if not already paid
        const existing = await Purchase.findOne({ project: projectId, paymentStatus: "paid" });
        if (!existing) {
          const bid = await Bid.findById(bidId);
          if (bid) {
            await Purchase.findOneAndUpdate(
              { project: projectId, buyer: buyerId },
              {
                project: projectId,
                buyer: buyerId,
                freelancer: bid.bidder,
                amount: bid.amount,
                paymentStatus: "paid",
                razorpayOrderId: payment.order_id,
                razorpayPaymentId: payment.id,
                paidAt: new Date(),
              },
              { upsert: true, returnDocument: 'after' }
            );
          }
        }
      }
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.error("webhookHandler error:", error);
    res.status(500).json({ message: "Webhook processing error" });
  }
};

// GET /api/payments/status/:projectId
// Check payment status for a specific project (called by client to show Pay Now button)
export const getPaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchase = await Purchase.findOne({
      project: req.params.projectId,
      buyer: req.user!._id,
    });

    if (!purchase) {
      res.json({ hasPurchase: false, paymentStatus: null, amount: null });
      return;
    }

    res.json({
      hasPurchase: true,
      paymentStatus: purchase.paymentStatus,
      amount: purchase.amount,
      paidAt: purchase.paidAt,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
