import express from "express";
import { nukeDatabase } from "../controllers/admin.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/nuke-db", protectRoute, nukeDatabase);

export default router;
