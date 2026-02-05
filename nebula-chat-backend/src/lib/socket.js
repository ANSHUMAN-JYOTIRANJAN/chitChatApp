import { Server } from "socket.io";
import cookie from "cookie";
import cookieSession from "cookie-session";
import User from "../models/User.js";

let io;
const onlineUsers = new Map();

export const initSocket = (server, CLIENT_URL) => {
  io = new Server(server, {
    cors: {
      origin: CLIENT_URL,
      credentials: true,
    },
  });

  /* -------- SOCKET AUTH (SESSION-BASED) -------- */
  io.use(async (socket, next) => {
    try {
      const cookies = socket.handshake.headers.cookie;
      if (!cookies) return next(new Error("No cookies"));

      const parsed = cookie.parse(cookies);
      const sessionCookie = parsed.session;
      if (!sessionCookie) return next(new Error("No session"));

      // cookie-session stores JSON
      const session = JSON.parse(
        Buffer.from(sessionCookie.split(".")[0], "base64").toString()
      );

      const userId = session?.passport?.user;
      if (!userId) return next(new Error("Not authenticated"));

      const user = await User.findById(userId);
      if (!user) return next(new Error("User not found"));

      socket.user = user;
      socket.userId = user._id.toString();

      next();
    } catch (err) {
      next(new Error("Socket auth failed"));
    }
  });

  /* -------- CONNECTION -------- */
  io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.user.displayName);

    onlineUsers.set(socket.userId, socket.id);
    io.emit("getUsers", Array.from(onlineUsers.keys()));

    socket.on("callUser", ({ receiverId, type }) => {
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("incomingCall", {
          senderId: socket.userId,
          type,
        });
      } else {
        socket.emit("userOffline");
      }
    });

    socket.on("answerCall", ({ senderId }) => {
      const senderSocketId = onlineUsers.get(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("callAccepted");
      }
    });

    socket.on("endCall", ({ targetId }) => {
      const targetSocketId = onlineUsers.get(targetId);
      if (targetSocketId) {
        io.to(targetSocketId).emit("callEnded");
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.userId);
      io.emit("getUsers", Array.from(onlineUsers.keys()));
      console.log("❌ Socket disconnected:", socket.user.displayName);
    });
  });

  return io;
};

export const getReceiverSocketId = (userId) =>
  onlineUsers.get(userId?.toString());

export { io };
