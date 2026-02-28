import { Request, Response } from "express";
import Project from "../models/Project";
import User from "../models/User";
import Purchase from "../models/Purchase";
import Rating from "../models/Rating";
import Bid from "../models/Bid";
import Notification from "../models/Notification";

// PATCH /api/admin/projects/:id/approve
export const approveProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status: "open" },
      { returnDocument: 'after' }
    ).populate("seller", "name avatar rating completedProjects role");

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({ message: "Project approved", project });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/admin/projects/:id/reject
export const rejectProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status: "cancelled" },
      { returnDocument: 'after' }
    ).populate("seller", "name avatar rating completedProjects role");

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({ message: "Project rejected", project });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/admin/projects/:id/complete  — Admin confirms freelancer's work
export const completeProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (project.status !== "in-progress") {
      res.status(400).json({ message: "Only in-progress projects can be confirmed" });
      return;
    }

    if (!project.workSubmitted) {
      res.status(400).json({ message: "Freelancer has not submitted work yet" });
      return;
    }

    if (project.adminConfirmed) {
      res.status(400).json({ message: "Admin has already confirmed this project" });
      return;
    }

    project.adminConfirmed = true;

    const acceptedBid = await Bid.findOne({ project: project._id, status: "accepted" });

    // If owner has also confirmed → move project to completed
    if (project.ownerConfirmed) {
      project.status = "completed";
      await project.save();

      // Increment freelancer's completedProjects
      if (acceptedBid) {
        await User.findByIdAndUpdate(acceptedBid.bidder, { $inc: { completedProjects: 1 } });

        // Notify freelancer that project is fully confirmed
        await Notification.create({
          type: "project_completed",
          message: `Both admin and the client have confirmed "${project.title}" is complete. Payment will be released shortly.`,
          projectId: project._id,
          actorId: project.seller,
          projectTitle: project.title,
          actorName: "Admin",
          recipientId: acceptedBid.bidder,
        });
      }

      // Notify buyer to make payment
      await Notification.create({
        type: "payment_pending",
        message: `Both you and admin have confirmed "${project.title}" is complete. Please make payment to release funds to the freelancer.`,
        projectId: project._id,
        actorId: project.seller,
        projectTitle: project.title,
        actorName: "Admin",
        recipientId: project.seller,
      });

      res.json({ message: "Project confirmed complete. Buyer notified to make payment.", project });
    } else {
      await project.save();

      // Notify freelancer that admin confirmed (owner still pending)
      if (acceptedBid) {
        await Notification.create({
          type: "work_confirmed_admin",
          message: `Admin has confirmed your work on "${project.title}". Waiting for client confirmation.`,
          projectId: project._id,
          actorId: project.seller,
          projectTitle: project.title,
          actorName: "Admin",
          recipientId: acceptedBid.bidder,
        });
      }

      res.json({ message: "Admin confirmation saved. Waiting for project owner to also confirm.", project });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/admin/stats  — accessible by any logged-in user (verifyJWT only)
export const getStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalProjects, totalUsers, openProjects, completedProjects, totalPurchases, totalBids] =
      await Promise.all([
        Project.countDocuments(),
        User.countDocuments({ role: { $ne: "admin" } }),
        Project.countDocuments({ status: "open" }),
        Project.countDocuments({ status: "completed" }),
        Purchase.countDocuments(),
        Bid.countDocuments(),
      ]);

    const completionRate =
      totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100 * 10) / 10 : 0;

    res.json({
      totalProjects,
      totalUsers,
      openProjects,
      completedProjects,
      totalPurchases,
      completionRate,
      totalBids,
      liveProjects: openProjects,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/admin/analytics
export const getAnalytics = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Monthly project counts for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyData = await Project.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    const barData = monthlyData.map((item) => ({
      month: monthNames[item._id.month - 1],
      projects: item.count,
    }));

    // Category distribution
    const categoryData = await Project.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const pieData = categoryData.map((item) => ({
      name: item._id,
      value: item.count,
    }));

    res.json({ barData, pieData });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/categories
export const getCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    // All predefined categories — always returned regardless of project count
    const ALL_CATEGORIES = [
      { id: "web-dev",           name: "Web Development",         icon: "Globe"      },
      { id: "mobile",            name: "Mobile Apps",              icon: "Smartphone" },
      { id: "design",            name: "UI/UX & Design",           icon: "Palette"    },
      { id: "writing",           name: "Content & Writing",        icon: "FileText"   },
      { id: "marketing",         name: "Social Media & Marketing", icon: "TrendingUp" },
      { id: "data",              name: "Data Science & AI",        icon: "BarChart3"  },
      { id: "prog-tech",         name: "Programming & Tech",       icon: "Code2"      },
      { id: "digital-marketing", name: "SEO & Performance",        icon: "Megaphone"  },
      { id: "video",             name: "Video & Animation",        icon: "Video"      },
      { id: "finance",           name: "Finance & Accounting",     icon: "DollarSign" },
    ];

    // Get counts from open projects (only what exists in DB)
    const categoryData = await Project.aggregate([
      { $match: { status: "open" } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);
    const countMap: Record<string, number> = {};
    categoryData.forEach((item) => { countMap[item._id] = item.count; });

    // Merge: always return all categories, fill count from DB (0 if none)
    const categories = ALL_CATEGORIES.map((cat) => ({
      ...cat,
      count: countMap[cat.id] || 0,
    }));

    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/admin/projects  (all projects for admin table)
export const getAllProjects = async (_req: Request, res: Response): Promise<void> => {
  try {
    const projects = await Project.find()
      .populate("seller", "name avatar rating completedProjects role")
      .sort({ createdAt: -1 });

    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/admin/ratings
export const getAllRatings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ratings = await Rating.find()
      .populate("rater", "name avatar")
      .populate("ratee", "name avatar")
      .populate("project", "title")
      .sort({ createdAt: -1 });

    res.json(ratings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/admin/bids
export const getAllBids = async (_req: Request, res: Response): Promise<void> => {
  try {
    const bids = await Bid.find()
      .populate("bidder", "name avatar email rating")
      .populate("project", "title category budget")
      .sort({ createdAt: -1 });

    res.json(bids);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/admin/bids/:id/approve
export const approveBid = async (req: Request, res: Response): Promise<void> => {
  try {
    const bid = await Bid.findById(req.params.id);
    if (!bid) {
      res.status(404).json({ message: "Bid not found" });
      return;
    }

    bid.adminStatus = "approved";
    await bid.save();

    // Notify the bidder that admin approved their bid
    const project = await Project.findById(bid.project).select("title");
    if (project) {
      await Notification.create({
        type: "bid_approved_admin",
        message: `Your bid on "${project.title}" has been approved by admin. The project owner can now accept it.`,
        bidId: bid._id,
        projectId: project._id,
        actorId: bid.bidder,
        projectTitle: project.title,
        actorName: "Admin",
        recipientId: bid.bidder,
      });
    }

    res.json({ message: "Bid approved", bid });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/admin/bids/:id/reject
export const rejectAdminBid = async (req: Request, res: Response): Promise<void> => {
  try {
    const bid = await Bid.findById(req.params.id);
    if (!bid) {
      res.status(404).json({ message: "Bid not found" });
      return;
    }

    bid.adminStatus = "rejected_admin";
    bid.status = "rejected";
    await bid.save();

    // Notify the bidder that admin rejected their bid
    const project = await Project.findById(bid.project).select("title");
    if (project) {
      await Notification.create({
        type: "bid_rejected_admin",
        message: `Your bid on "${project.title}" was not approved by admin.`,
        bidId: bid._id,
        projectId: project._id,
        actorId: bid.bidder,
        projectTitle: project.title,
        actorName: "Admin",
        recipientId: bid.bidder,
      });
    }

    res.json({ message: "Bid rejected", bid });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/admin/payments
export const getAllPayments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const payments = await Purchase.find({ paymentStatus: "paid" })
      .populate("buyer",      "name avatar email")
      .populate("freelancer", "name avatar email")
      .populate("project",    "title category")
      .sort({ paidAt: -1 });

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// GET /api/admin/notifications
export const getNotifications = async (_req: Request, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/admin/notifications/read-all
export const markAllNotificationsRead = async (_req: Request, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ read: false }, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// PATCH /api/admin/notifications/:id/read
export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
