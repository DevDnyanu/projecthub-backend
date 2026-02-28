import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import connectDB from "./config/db";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import projectRoutes from "./routes/project.routes";
import bidRoutes from "./routes/bid.routes";
import ratingRoutes from "./routes/rating.routes";
import adminRoutes from "./routes/admin.routes";
import categoryRoutes from "./routes/category.routes";
import notificationRoutes from "./routes/notification.routes";
import alertRoutes from "./routes/alert.routes";
import paymentRoutes from "./routes/payment.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, mobile apps)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Raw body for Razorpay webhook BEFORE express.json() parses it
// (Razorpay HMAC verification needs the raw request body string)
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve locally uploaded avatars (fallback when Cloudinary is not configured)
app.use("/avatars", express.static(path.join(__dirname, "../public/avatars")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/bids", bidRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/payments", paymentRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", message: "ProjectHub API is running" });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
});

export default app;
