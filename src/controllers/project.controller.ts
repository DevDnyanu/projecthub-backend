import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Project from "../models/Project";
import Purchase from "../models/Purchase";
import Notification from "../models/Notification";
import Bid from "../models/Bid";
import User from "../models/User";
import cloudinary from "../config/cloudinary";
import fs from "fs";

// GET /api/projects
export const getProjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, search, status, limit, since } = req.query;

    const filter: Record<string, unknown> = {};

    // Public endpoint: never show pending projects
    if (!status) {
      filter.status = { $ne: "pending" };
    } else {
      filter.status = status;
    }

    if (category && category !== "all") filter.category = String(category);
    if (search) {
      const term  = String(search).trim();
      const regex = { $regex: term, $options: "i" };
      filter.$or = [
        { title:        regex },
        { description:  regex },
        { category:     regex },
        { subcategory:  regex },
        { companyName:  regex },
        { location:     regex },
        { projectType:  regex },
        { urgencyLevel: regex },
        { skills:       { $elemMatch: regex } },
        { posterSkills: { $elemMatch: regex } },
      ];
    }
    // For project alerts: only return projects newer than a timestamp
    if (since) {
      filter.createdAt = { $gt: new Date(since as string) };
    }

    const query = Project.find(filter)
      .populate("seller", "name avatar rating completedProjects role linkedinUrl")
      .sort({ createdAt: -1 });

    if (limit) query.limit(Number(limit));

    const projects = await query;
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/projects/:id
export const getProjectById = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id).populate(
      "seller",
      "name avatar rating completedProjects role linkedinUrl"
    );

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// POST /api/projects
export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      title, description, category, subcategory,
      skills, budgetMin, budgetMax, deadline, deliveryDays,
      projectType, posterSkills,
      companyName, location, remoteFriendly, urgencyLevel,
    } = req.body;

    if (!title || !description || !category || !budgetMin || !budgetMax || !deadline) {
      res.status(400).json({ message: "Title, description, category, budget and deadline are required" });
      return;
    }

    // Upload attachments to Cloudinary
    const attachmentUrls: string[] = [];
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files as Express.Multer.File[]) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "projecthub/attachments",
            resource_type: "auto",
          });
          attachmentUrls.push(result.secure_url);
          fs.unlinkSync(file.path);
        } catch {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
      }
    }

    const project = await Project.create({
      title: String(title).trim(),
      description: String(description).trim(),
      category,
      subcategory: subcategory || "",
      skills: Array.isArray(skills) ? skills : (skills ? String(skills).split(",").map((s: string) => s.trim()) : []),
      budget: { min: Number(budgetMin), max: Number(budgetMax) },
      deliveryDays: Number(deliveryDays) || 0,
      deadline: new Date(deadline),
      seller: req.user!._id,
      status: "pending",
      projectType: projectType || "Fixed Price",
      posterSkills: Array.isArray(posterSkills) ? posterSkills : (posterSkills ? String(posterSkills).split(",").map((s: string) => s.trim()) : []),
      companyName: companyName || "",
      location: location || "",
      remoteFriendly: remoteFriendly !== undefined ? remoteFriendly === true || remoteFriendly === "true" : true,
      urgencyLevel: urgencyLevel || "Normal",
      attachments: attachmentUrls,
    });

    const populated = await project.populate("seller", "name avatar rating completedProjects role linkedinUrl");

    // Notify admin about the new project
    try {
      const sellerName = (populated.seller as unknown as { name?: string })?.name || "a user";
      await Notification.create({
        type: "new_project",
        message: `New project "${project.title}" posted by ${sellerName}`,
        projectId: project._id,
        actorId: req.user!._id,
        projectTitle: project.title,
        actorName: sellerName,
      });
    } catch { /* non-blocking */ }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/projects/:id/submit-work  — accepted freelancer submits work to client
export const submitWork = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (project.status !== "in-progress") {
      res.status(400).json({ message: "Work can only be submitted for in-progress projects" });
      return;
    }

    // Check that current user is the accepted bidder
    const acceptedBid = await Bid.findOne({ project: project._id, status: "accepted", bidder: req.user!._id });
    if (!acceptedBid) {
      res.status(403).json({ message: "Only the accepted freelancer can submit work" });
      return;
    }

    project.workSubmitted = true;
    await project.save();

    const freelancerUser = await User.findById(req.user!._id).select("name");

    // Notify admin (no recipientId)
    await Notification.create({
      type: "work_submitted",
      message: `${freelancerUser?.name || "Freelancer"} has marked project "${project.title}" as complete. Admin confirmation required.`,
      projectId: project._id,
      actorId: req.user!._id,
      projectTitle: project.title,
      actorName: freelancerUser?.name || "",
    });

    // Notify project owner (buyer)
    await Notification.create({
      type: "work_submitted",
      message: `${freelancerUser?.name || "Freelancer"} has completed the work on "${project.title}". Please review and confirm completion.`,
      projectId: project._id,
      actorId: req.user!._id,
      projectTitle: project.title,
      actorName: freelancerUser?.name || "",
      recipientId: project.seller,
    });

    res.json({ message: "Project marked as complete. Both admin and client have been notified.", project });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/projects/:id/confirm-complete  — project owner confirms freelancer's work
export const ownerConfirmComplete = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (project.seller.toString() !== req.user!._id.toString()) {
      res.status(403).json({ message: "Only the project owner can confirm completion" });
      return;
    }

    if (project.status !== "in-progress") {
      res.status(400).json({ message: "Project must be in-progress to confirm completion" });
      return;
    }

    if (!project.workSubmitted) {
      res.status(400).json({ message: "Freelancer has not marked the project as complete yet" });
      return;
    }

    if (project.ownerConfirmed) {
      res.status(400).json({ message: "You have already confirmed completion" });
      return;
    }

    project.ownerConfirmed = true;

    const acceptedBid = await Bid.findOne({ project: project._id, status: "accepted" });

    // If admin has also confirmed → move project to completed
    if (project.adminConfirmed) {
      project.status = "completed";
      await project.save();

      // Notify owner to make payment
      await Notification.create({
        type: "payment_pending",
        message: `Both you and admin have confirmed "${project.title}" is complete. Please make payment to release funds to the freelancer.`,
        projectId: project._id,
        actorId: req.user!._id,
        projectTitle: project.title,
        actorName: "System",
        recipientId: project.seller,
      });

      // Notify freelancer that project is fully confirmed and payment is pending
      if (acceptedBid) {
        await User.findByIdAndUpdate(acceptedBid.bidder, { $inc: { completedProjects: 1 } });
        await Notification.create({
          type: "project_completed",
          message: `Both the client and admin have confirmed "${project.title}" is complete. Payment will be released shortly.`,
          projectId: project._id,
          actorId: req.user!._id,
          projectTitle: project.title,
          actorName: "System",
          recipientId: acceptedBid.bidder,
        });
      }

      res.json({ message: "Completion confirmed. Project is now complete. Please proceed with payment.", project });
    } else {
      await project.save();

      // Notify freelancer that owner confirmed (admin still pending)
      if (acceptedBid) {
        await Notification.create({
          type: "work_confirmed_owner",
          message: `The client has confirmed your work on "${project.title}". Waiting for admin confirmation.`,
          projectId: project._id,
          actorId: req.user!._id,
          projectTitle: project.title,
          actorName: "System",
          recipientId: acceptedBid.bidder,
        });
      }

      res.json({ message: "Completion confirmed. Waiting for admin to also confirm.", project });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/projects/:id/complete  — project owner marks work as done
export const markProjectComplete = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Only the project owner can mark it complete
    if (project.seller.toString() !== req.user!._id.toString()) {
      res.status(403).json({ message: "Only the project owner can mark this complete" });
      return;
    }

    if (project.status !== "in-progress") {
      res.status(400).json({ message: "Only in-progress projects can be marked complete" });
      return;
    }

    project.status = "completed";
    await project.save();

    // Find the accepted bid to notify the freelancer
    const acceptedBid = await Bid.findOne({ project: project._id, status: "accepted" });
    if (acceptedBid) {
      // Increment freelancer's completedProjects count
      await User.findByIdAndUpdate(acceptedBid.bidder, { $inc: { completedProjects: 1 } });

      // Mark payment as released
      await Purchase.findOneAndUpdate(
        { project: project._id, paymentStatus: "paid" },
        { paymentStatus: "released", releasedAt: new Date() }
      );

      // Notify the freelancer
      const ownerUser = await User.findById(req.user!._id).select("name");
      const purchase = await Purchase.findOne({ project: project._id });
      await Notification.create({
        type: "project_completed",
        message: `The project "${project.title}" has been marked complete by the client. Great work!`,
        projectId: project._id,
        actorId: req.user!._id,
        projectTitle: project.title,
        actorName: ownerUser?.name || "",
        recipientId: acceptedBid.bidder,
      });

      // Payment release notification
      if (purchase && purchase.paymentStatus === "released") {
        await Notification.create({
          type: "payment_released",
          message: `Payment of ₹${purchase.amount.toLocaleString("en-IN")} for "${project.title}" has been released to you.`,
          projectId: project._id,
          actorId: req.user!._id,
          projectTitle: project.title,
          actorName: ownerUser?.name || "",
          recipientId: acceptedBid.bidder,
        });
      }
    }

    res.json({ message: "Project marked as completed", project });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/users/me/posted
export const getMyPostedProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await Project.find({ seller: req.user!._id })
      .populate("seller", "name avatar rating completedProjects role linkedinUrl")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/users/me/assigned  — projects where current user's bid was accepted
export const getMyAssignedProjects = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Include accepted bids OR admin-approved bids (backward compat with old data)
    const myBids = await Bid.find({
      bidder: req.user!._id,
      $or: [
        { status: "accepted" },
        { adminStatus: "approved", status: { $ne: "rejected" } },
      ],
    })
      .populate({
        path: "project",
        populate: { path: "seller", select: "name avatar rating completedProjects role linkedinUrl" },
      })
      .sort({ createdAt: -1 });

    // De-duplicate by project ID (in case both conditions match same bid)
    const seen = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projects = (myBids as any[])
      .map((bid) => bid.project)
      .filter((p) => {
        if (!p || !p._id) return false;
        const id = p._id.toString();
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/users/me/purchases
export const getMyPurchases = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchases = await Purchase.find({ buyer: req.user!._id })
      .populate({
        path: "project",
        populate: { path: "seller", select: "name avatar rating completedProjects role linkedinUrl" },
      })
      .sort({ createdAt: -1 });

    res.json(purchases);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
