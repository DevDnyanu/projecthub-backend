import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import User from "../models/User";
import { getCloudinary } from "../config/cloudinary";
import fs from "fs";
import path from "path";

// Check if real Cloudinary credentials are configured
const isCloudinaryReady = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  return (
    CLOUDINARY_CLOUD_NAME &&
    CLOUDINARY_API_KEY &&
    CLOUDINARY_API_SECRET &&
    CLOUDINARY_CLOUD_NAME !== "your_cloud_name" &&
    CLOUDINARY_API_KEY    !== "your_api_key"    &&
    CLOUDINARY_API_SECRET !== "your_api_secret"
  );
};

// PATCH /api/users/me/avatar
export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    let avatarUrl: string;

    if (isCloudinaryReady()) {
      // ── Upload to Cloudinary ──
      const cloudinary = getCloudinary();
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "projecthub/avatars",
        width: 200,
        height: 200,
        crop: "fill",
        gravity: "face",
      });
      fs.unlinkSync(req.file.path); // clean up temp file
      avatarUrl = result.secure_url;
    } else {
      // ── Local fallback (development) ──
      const avatarsDir = path.join(__dirname, "../../public/avatars");
      if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

      const ext  = path.extname(req.file.originalname) || ".jpg";
      const filename = `${req.user!._id}-${Date.now()}${ext}`;
      const destPath = path.join(avatarsDir, filename);

      fs.renameSync(req.file.path, destPath);

      const port = process.env.PORT || 5000;
      avatarUrl = `http://localhost:${port}/avatars/${filename}`;
    }

    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { avatar: avatarUrl },
      { returnDocument: "after" }
    ).select("-password");

    res.json({ avatar: user!.avatar });
  } catch (error) {
    res.status(500).json({ message: "Avatar upload failed", error });
  }
};

// PATCH /api/users/me/profile
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name, email, linkedinUrl,
      skills, experienceLevel, yearsOfExperience,
      bio, portfolioUrl, availability,
    } = req.body;

    const updates: Record<string, unknown> = {};
    if (name) updates.name = String(name).trim();

    // Email change: check for duplicates
    if (email) {
      const newEmail = (email as string).toLowerCase().trim();
      const existing = await User.findOne({ email: newEmail, _id: { $ne: req.user!._id } });
      if (existing) {
        res.status(409).json({ message: "Email already in use by another account" });
        return;
      }
      updates.email = newEmail;
    }

    if (linkedinUrl !== undefined) updates.linkedinUrl = String(linkedinUrl).trim();
    if (Array.isArray(skills)) updates.skills = skills;
    if (experienceLevel !== undefined) updates.experienceLevel = experienceLevel;
    if (yearsOfExperience !== undefined) updates.yearsOfExperience = Number(yearsOfExperience);
    if (bio !== undefined) updates.bio = String(bio).trim();
    if (portfolioUrl !== undefined) updates.portfolioUrl = String(portfolioUrl).trim();
    if (availability !== undefined) updates.availability = availability;

    const user = await User.findByIdAndUpdate(req.user!._id, updates, { returnDocument: 'after' }).select(
      "-password -emailVerifyToken"
    );

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/users/me/change-password
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Current password and new password are required" });
      return;
    }

    if ((newPassword as string).length < 6) {
      res.status(400).json({ message: "New password must be at least 6 characters" });
      return;
    }

    const user = await User.findById(req.user!._id);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    user.password = newPassword; // pre-save hook will hash it
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/users/search?q=QUERY
export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query as { q: string };

    if (!q || q.trim().length < 2) {
      res.json([]);
      return;
    }

    const users = await User.find({
      name: { $regex: q.trim(), $options: "i" },
      role: { $ne: "admin" },
    })
      .select("name avatar role rating completedProjects")
      .limit(8)
      .lean();

    const result = users.map((u) => ({
      id: u._id,
      name: u.name,
      avatar: u.avatar,
      role: u.role,
      rating: u.rating,
      completedProjects: u.completedProjects,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/users/:id
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select(
      "-password -email -emailVerifyToken"
    );
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
