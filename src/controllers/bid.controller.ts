import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Bid from "../models/Bid";
import Project from "../models/Project";
import User from "../models/User";
import Notification from "../models/Notification";

// POST /api/projects/:id/bids
export const placeBid = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      amount, deliveryDays, coverLetter,
      skills, experienceLevel, yearsOfExperience,
      bio, portfolioUrl, linkedinUrl, availability,
    } = req.body;
    const projectId = req.params.id;

    if (!amount || !deliveryDays || !coverLetter) {
      res.status(400).json({ message: "Amount, delivery days and cover letter are required" });
      return;
    }
    if (String(coverLetter).trim().length < 50) {
      res.status(400).json({ message: "Cover letter must be at least 50 characters" });
      return;
    }

    const project = await Project.findById(projectId);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    if (project.status !== "open") {
      res.status(400).json({ message: "Bids are only accepted on open projects" });
      return;
    }

    const existing = await Bid.findOne({ project: projectId, bidder: req.user!._id });
    if (existing) {
      res.status(409).json({ message: "You have already placed a bid on this project" });
      return;
    }

    const bid = await Bid.create({
      project: projectId,
      bidder: req.user!._id,
      amount: Number(amount),
      deliveryDays: Number(deliveryDays),
      coverLetter: String(coverLetter).trim(),
      skills: Array.isArray(skills) ? skills : [],
      experienceLevel: experienceLevel || "",
      yearsOfExperience: Number(yearsOfExperience) || 0,
      bio: bio || "",
      portfolioUrl: portfolioUrl || "",
      linkedinUrl: linkedinUrl || "",
      availability: availability || "",
      status: "pending",
      adminStatus: "pending_admin",
    });

    // Update the user's profile with bid profile data
    await User.findByIdAndUpdate(req.user!._id, {
      ...(Array.isArray(skills) && skills.length > 0 && { skills }),
      ...(experienceLevel && { experienceLevel }),
      ...(yearsOfExperience !== undefined && { yearsOfExperience: Number(yearsOfExperience) }),
      ...(bio && { bio }),
      ...(portfolioUrl && { portfolioUrl }),
      ...(linkedinUrl && { linkedinUrl }),
      ...(availability && { availability }),
    });

    await Project.findByIdAndUpdate(projectId, { $inc: { bidsCount: 1 } });

    const bidderUser = await User.findById(req.user!._id).select("name");

    // Admin notification (no recipientId)
    await Notification.create({
      type: "new_bid",
      message: `New bid on "${project.title}" by ${bidderUser?.name || "a user"}`,
      bidId: bid._id,
      projectId: project._id,
      actorId: req.user!._id,
      projectTitle: project.title,
      actorName: bidderUser?.name || "",
    });

    // Notify project owner (buyer) that a new bid arrived
    await Notification.create({
      type: "new_bid",
      message: `${bidderUser?.name || "Someone"} placed a bid on your project "${project.title}"`,
      bidId: bid._id,
      projectId: project._id,
      actorId: req.user!._id,
      projectTitle: project.title,
      actorName: bidderUser?.name || "",
      recipientId: project.seller,
    });

    const populated = await bid.populate("bidder", "name avatar rating completedProjects skills experienceLevel linkedinUrl");
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/projects/:id/bids
export const getBidsForProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    const isOwner = project.seller.toString() === req.user!._id.toString();

    let bids;
    if (isOwner) {
      bids = await Bid.find({ project: req.params.id })
        .populate("bidder", "name avatar rating completedProjects skills experienceLevel linkedinUrl bio portfolioUrl")
        .sort({ createdAt: -1 });
    } else {
      bids = await Bid.find({ project: req.params.id, bidder: req.user!._id })
        .populate("bidder", "name avatar rating completedProjects skills experienceLevel linkedinUrl bio portfolioUrl")
        .sort({ createdAt: -1 });
    }

    res.json(bids);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/bids/:bidId
export const updateBidStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    if (!status || !["accepted", "rejected"].includes(status)) {
      res.status(400).json({ message: "Status must be 'accepted' or 'rejected'" });
      return;
    }

    const bid = await Bid.findById(req.params.bidId);
    if (!bid) {
      res.status(404).json({ message: "Bid not found" });
      return;
    }

    const project = await Project.findById(bid.project);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (project.seller.toString() !== req.user!._id.toString()) {
      res.status(403).json({ message: "Only the project owner can accept or reject bids" });
      return;
    }

    // Admin must approve the bid before the owner can accept it
    if (status === "accepted" && bid.adminStatus !== "approved") {
      res.status(400).json({ message: "Admin must approve this bid first before you can accept it" });
      return;
    }

    bid.status = status;
    await bid.save();

    // On acceptance, move project to in-progress immediately (no payment required yet)
    if (status === "accepted") {
      await Project.findByIdAndUpdate(bid.project, { status: "in-progress" });
    }

    // Notify the bidder (freelancer) about the outcome
    const ownerUser = await User.findById(req.user!._id).select("name");
    await Notification.create({
      type: status === "accepted" ? "bid_accepted" : "bid_rejected",
      message:
        status === "accepted"
          ? `Your bid on "${project.title}" was accepted! The project is now in progress. Start working!`
          : `Your bid on "${project.title}" was not selected this time.`,
      bidId: bid._id,
      projectId: project._id,
      actorId: req.user!._id,
      projectTitle: project.title,
      actorName: ownerUser?.name || "",
      recipientId: bid.bidder,
    });

    const populated = await bid.populate("bidder", "name avatar rating completedProjects skills experienceLevel linkedinUrl");
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
