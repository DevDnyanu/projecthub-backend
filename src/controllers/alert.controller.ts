import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import SavedAlert from "../models/SavedAlert";

// GET /api/alerts — user's saved alerts
export const getSavedAlerts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alerts = await SavedAlert.find({ userId: req.user!._id }).sort({ createdAt: -1 });
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/alerts — create a saved alert
export const createSavedAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, category, skills, budgetMin, budgetMax } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Alert name is required" });
      return;
    }

    const count = await SavedAlert.countDocuments({ userId: req.user!._id });
    if (count >= 10) {
      res.status(400).json({ message: "Maximum 10 saved alerts allowed" });
      return;
    }

    const alert = await SavedAlert.create({
      userId:    req.user!._id,
      name:      name.trim(),
      category:  category || "",
      skills:    Array.isArray(skills) ? skills : [],
      budgetMin: budgetMin ? Number(budgetMin) : undefined,
      budgetMax: budgetMax ? Number(budgetMax) : undefined,
    });

    res.status(201).json(alert);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// DELETE /api/alerts/:id — delete a saved alert
export const deleteSavedAlert = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const alert = await SavedAlert.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!._id,
    });

    if (!alert) {
      res.status(404).json({ message: "Alert not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
