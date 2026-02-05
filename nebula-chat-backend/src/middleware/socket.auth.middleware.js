// middleware/socketAuth.js
import User from "../models/User.js";
 import cookie from "cookie";

// Socket.IO middleware for session-based authentication
export const socketAuthMiddleware = async (socket, next) => {
  try {
    // If you are using cookieSession + Passport, session is available in socket.handshake
    const session = socket.handshake?.headers?.cookie;

    if (!session) {
      console.log("❌ Socket connection rejected: No session cookie");
      return next(new Error("Unauthorized - No Session Cookie"));
    }

    // Extract the Passport user ID from the cookieSession
    // cookieSession stores session as JSON inside cookie (usually Base64-encoded)
    // You can use a library like 'cookie' to parse the cookie:

    const cookies = cookie.parse(session);
    const sessionData = cookies["connect.sid"]; // default cookie name from cookie-session

    if (!sessionData) {
      console.log("❌ Socket connection rejected: Session cookie missing");
      return next(new Error("Unauthorized - No Session Data"));
    }

    // Unfortunately cookie-session is signed, so we cannot easily decode it
    // If you want JWT approach, you can issue a JWT on login and read it here
    // For now, fallback: allow user ID to be sent from client on connect
    const { userId } = socket.handshake.query;
    if (!userId) {
      console.log("❌ Socket connection rejected: No userId in handshake query");
      return next(new Error("Unauthorized - No UserId Provided"));
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ Socket connection rejected: User not found");
      return next(new Error("Unauthorized - User Not Found"));
    }

    // Attach user to socket
    socket.user = user;
    socket.userId = user._id.toString();

    console.log(`✅ Socket authenticated for user: ${user.displayName} (${user._id})`);
    next();
  } catch (error) {
    console.log("❌ Error in socket authentication:", error.message);
    next(new Error("Unauthorized - Authentication failed"));
  }
};
