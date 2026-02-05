import express from "express";
import {
  getCurrentUser,
  updateUser,
} from "../controllers/user.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/current", protectRoute, getCurrentUser);
router.put("/update", protectRoute, updateUser);

export default router;
