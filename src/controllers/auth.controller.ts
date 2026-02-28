import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User";
import { AuthRequest } from "../middleware/auth";
import { sendVerificationEmail, sendOtpEmail } from "../config/mailer";

const signToken = (id: string): string =>
  jwt.sign({ id }, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  } as jwt.SignOptions);

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ message: "Name, email and password are required" });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: "Email already in use" });
      return;
    }

    const emailVerifyToken = crypto.randomBytes(32).toString("hex");

    const user = await User.create({
      name,
      email,
      password,
      role: role || "buyer",
      isEmailVerified: false,
      emailVerifyToken,
    });

    // Send verification email (non-blocking — don't fail registration if email fails)
    sendVerificationEmail(email, name, emailVerifyToken).catch((err) =>
      console.error("Failed to send verification email:", err.message)
    );

    const token = signToken(user._id.toString());

    res.status(201).json({
      token,
      needsVerification: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        rating: user.rating,
        completedProjects: user.completedProjects,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = signToken(user._id.toString());

    res.json({
      token,
      needsVerification: !user.isEmailVerified,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        rating: user.rating,
        completedProjects: user.completedProjects,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/auth/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      role: user.role,
      rating: user.rating,
      completedProjects: user.completedProjects,
      isEmailVerified: user.isEmailVerified,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/auth/verify-email?token=TOKEN&email=EMAIL
export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, email } = req.query as { token: string; email: string };

    if (!token || !email) {
      res.status(400).json({ message: "Token and email are required" });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    if (user.isEmailVerified) {
      res.json({ message: "Email already verified. You can sign in." });
      return;
    }

    if (user.emailVerifyToken !== token) {
      res.status(400).json({ message: "Invalid or expired verification link" });
      return;
    }

    user.isEmailVerified = true;
    user.emailVerifyToken = "";
    await user.save();

    res.json({ message: "Email verified successfully! You can now sign in." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/auth/forgot-password
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const user = await User.findOne({ email: (email as string).toLowerCase() });

    // Always respond the same way — don't reveal whether email exists
    const genericMsg = "If an account with that email exists, a password reset link has been sent.";

    if (!user) {
      res.json({ message: genericMsg });
      return;
    }

    // Generate 6-digit OTP, store hashed version
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    user.passwordResetToken   = hashedOtp;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send OTP email (non-blocking)
    sendOtpEmail(user.email, user.name, otp).catch((err) =>
      console.error("Failed to send OTP email:", err.message)
    );

    res.json({ message: genericMsg });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/auth/verify-otp
// Just checks OTP validity — does NOT reset the password yet
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ message: "Email and OTP are required" });
      return;
    }

    const hashedOtp = crypto.createHash("sha256").update(otp as string).digest("hex");
    const user = await User.findOne({
      email: (email as string).toLowerCase(),
      passwordResetToken: hashedOtp,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ message: "OTP is invalid or has expired." });
      return;
    }

    res.json({ message: "OTP verified." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { otp, email, password } = req.body;

    if (!otp || !email || !password) {
      res.status(400).json({ message: "OTP, email and new password are required" });
      return;
    }

    if ((password as string).length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }

    const hashedOtp = crypto.createHash("sha256").update(otp as string).digest("hex");

    const user = await User.findOne({
      email: (email as string).toLowerCase(),
      passwordResetToken: hashedOtp,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({ message: "OTP is invalid or has expired. Please request a new one." });
      return;
    }

    user.password             = password;   // pre-save hook will hash it
    user.passwordResetToken   = "";
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successfully. You can now sign in with your new password." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/auth/resend-verification
export const resendVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ message: "No account found with this email" });
      return;
    }

    if (user.isEmailVerified) {
      res.status(400).json({ message: "Email is already verified" });
      return;
    }

    const newToken = crypto.randomBytes(32).toString("hex");
    user.emailVerifyToken = newToken;
    await user.save();

    await sendVerificationEmail(user.email, user.name, newToken);

    res.json({ message: "Verification email resent. Please check your inbox." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
