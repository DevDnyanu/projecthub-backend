import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Purchase from "../models/Purchase";
import Project from "../models/Project";

// POST /api/projects/:id/buy
export const buyProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projectId = req.params.id;

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (project.status !== "open") {
      res.status(400).json({ message: "Project is not available for purchase" });
      return;
    }

    // Check if already purchased
    const existing = await Purchase.findOne({ project: projectId, buyer: req.user!._id });
    if (existing) {
      res.status(409).json({ message: "You have already purchased this project" });
      return;
    }

    const purchase = await Purchase.create({
      project: projectId,
      buyer: req.user!._id,
    });

    // Update project status to in-progress
    await Project.findByIdAndUpdate(projectId, { status: "in-progress" });

    res.status(201).json({ message: "Bid accepted successfully", purchase });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
