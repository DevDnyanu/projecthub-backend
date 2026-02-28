import { Router } from "express";
import { getCategories } from "../controllers/admin.controller";

const router = Router();

router.get("/", getCategories);

export default router;
