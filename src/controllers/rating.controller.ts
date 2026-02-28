import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Rating from "../models/Rating";
import Bid from "../models/Bid";
import Project from "../models/Project";
import User from "../models/User";

// POST /api/ratings  — client rates the accepted freelancer after project completion
export const submitRating = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { projectId, stars, comment } = req.body;

    if (!projectId || !stars) {
      res.status(400).json({ message: "Project ID and stars are required" });
      return;
    }

    if (stars < 1 || stars > 5) {
      res.status(400).json({ message: "Stars must be between 1 and 5" });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (project.status !== "completed") {
      res.status(400).json({ message: "You can only rate completed projects" });
      return;
    }

    // Only the project owner (client) can rate
    if (project.seller.toString() !== req.user!._id.toString()) {
      res.status(403).json({ message: "Only the project owner can submit a rating" });
      return;
    }

    // Already rated?
    const existing = await Rating.findOne({ project: projectId, rater: req.user!._id });
    if (existing) {
      res.status(409).json({ message: "You have already rated this project" });
      return;
    }

    // Find the accepted bidder (freelancer to rate)
    const acceptedBid = await Bid.findOne({ project: projectId, status: "accepted" });
    if (!acceptedBid) {
      res.status(400).json({ message: "No accepted freelancer found for this project" });
      return;
    }

    const rating = await Rating.create({
      project: projectId,
      rater: req.user!._id,
      ratee: acceptedBid.bidder,
      stars: Number(stars),
      comment: comment || "",
    });

    // Recalculate freelancer's average rating
    const allRatings = await Rating.find({ ratee: acceptedBid.bidder });
    const avg = allRatings.reduce((sum, r) => sum + r.stars, 0) / allRatings.length;
    await User.findByIdAndUpdate(acceptedBid.bidder, {
      rating: Math.round(avg * 10) / 10,
      ratingCount: allRatings.length,
    });

    res.status(201).json({ message: "Rating submitted successfully", rating });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/ratings/check/:projectId  — check if current user already rated
export const checkRating = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const existing = await Rating.findOne({ project: req.params.projectId, rater: req.user!._id });
    res.json({ hasRated: !!existing, rating: existing ?? null });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/ratings/:userId  — get all ratings for a user
export const getUserRatings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ratings = await Rating.find({ ratee: req.params.userId })
      .populate("rater", "name avatar")
      .populate("project", "title")
      .sort({ createdAt: -1 });
    res.json(ratings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
