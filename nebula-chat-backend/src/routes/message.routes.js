import express from "express";
import { sendMessage, getMessages } from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/send", protectRoute, sendMessage);
router.get("/:contactId", protectRoute, getMessages);

export default router;
