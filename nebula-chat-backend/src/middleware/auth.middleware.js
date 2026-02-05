// middleware/protectRoute.js
import User from "../models/User.js";

export const protectRoute = async (req, res, next) => {
  try {
    // Passport sets req.user when the user is authenticated
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized - Not logged in" });
    }

    // Fetch latest user data from DB (optional, ensures updated info)
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.log("Error in protectRoute middleware:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
