import express from "express";
import passport from "passport";
import { googleCallback, logoutOAuth } from "../controllers/oauth.controller.js";

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/",
  }),
  googleCallback
);

router.get("/logout", logoutOAuth);

export default router;
