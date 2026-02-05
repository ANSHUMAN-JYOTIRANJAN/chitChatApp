
const express = require("express");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const mongoose = require("mongoose");
const cookieSession = require("cookie-session");
const cors = require("cors");
const crypto = require("crypto");
const http = require("http");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");

// --- ENVIRONMENT SETUP ---
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Critical Safety Check
if (!process.env.COOKIE_KEY || !process.env.MONGO_URI) {
  console.error("FATAL ERROR: COOKIE_KEY or MONGO_URI is not defined.");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Trust Proxy for Render
app.set("trust proxy", 1);

// --- URL CONFIGURATION ---
const PROD_FRONTEND = "https://nebula-ui.onrender.com";
const CLIENT_URL =
  process.env.NODE_ENV === "production"
    ? PROD_FRONTEND
    : "http://localhost:5173";

// --- MIDDLEWARE ---
app.use(
  cors({
    origin: CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

// [FIX] Increased Payload Limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// --- DATABASE CONNECTION ---
mongoose.set("strictQuery", false);
console.log("⏳ Connecting to MongoDB...");
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, 
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// --- SESSION CONFIG ---
app.use(
  cookieSession({
    maxAge: 30 * 24 * 60 * 60 * 1000,
    keys: [process.env.COOKIE_KEY],
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    httpOnly: true,
  }),
);

// Fix for Passport session regeneration
app.use((req, res, next) => {
  if (req.session && !req.session.regenerate) {
    req.session.regenerate = (cb) => {
      cb();
    };
  }
  if (req.session && !req.session.save) {
    req.session.save = (cb) => {
      cb();
    };
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

// --- SCHEMAS ---
const UserSchema = new mongoose.Schema({
  googleId: { type: String, index: true },
  displayName: String,
  email: String,
  avatar: String,
  shareId: { type: String, unique: true, index: true },
  bio: { type: String, default: "Hey! I am using Nebula Chat." },
  lastSeen: { type: Date, default: Date.now },
  contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});
const User = mongoose.model("User", UserSchema);

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: String,
  type: {
    type: String,
    enum: ["text", "image", "video", "file", "call"],
    default: "text",
  },
  fileUrl: String,
  fileName: String,
  callDetails: {
    status: { type: String, enum: ["missed", "ended"] },
    duration: String,
  },
  timestamp: { type: Date, default: Date.now },
  replyTo: String,
});
MessageSchema.index({ sender: 1, receiver: 1, timestamp: 1 });
MessageSchema.index({ receiver: 1, sender: 1, timestamp: 1 });
const Message = mongoose.model("Message", MessageSchema);

// --- SOCKET.IO ---
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST", "PUT"],
    credentials: true,
  },
});

let onlineUsers = [];
const getUser = (userId) =>
  onlineUsers.find((user) => user.userId === userId.toString());

io.on("connection", (socket) => {
  socket.on("addUser", (userId) => {
    onlineUsers = onlineUsers.filter((user) => user.userId !== userId);
    onlineUsers.push({ userId, socketId: socket.id });
    io.emit("getUsers", onlineUsers);
  });
  socket.on("callUser", ({ senderId, receiverId, type }) => {
    const user = getUser(receiverId);
    if (user) io.to(user.socketId).emit("incomingCall", { senderId, type });
  });
  socket.on("answerCall", ({ senderId }) => {
    const user = getUser(senderId);
    if (user) io.to(user.socketId).emit("callAccepted");
  });
  socket.on("endCall", ({ targetId }) => {
    const user = getUser(targetId);
    if (user) io.to(user.socketId).emit("callEnded");
  });
  socket.on("disconnect", () => {
    onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
    io.emit("getUsers", onlineUsers);
  });
});

// --- UTILS ---
const getRandomColor = (name) => {
  const colors = [
    "F44336",
    "E91E63",
    "9C27B0",
    "2196F3",
    "009688",
    "FFC107",
    "FF5722",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const generateShareId = () =>
  "NEB-" + crypto.randomBytes(3).toString("hex").toUpperCase();

// --- EMAIL CONFIGURATION ---
// [DEBUG] Log if credentials exist
console.log("📧 Email Config Check:", {
  hasUser: !!process.env.EMAIL_USER,
  hasPass: !!process.env.EMAIL_PASS,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log("⚠️  Email Service Warning: Invalid credentials. Welcome emails will not be sent.");
    // console.log(error.message); // Uncomment for debugging
  } else {
    console.log("✅ Email Server is ready to take our messages");
  }
});

// --- PASSPORT ---
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
      proxy: true,
    },
    async (token, refToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // 1. Create User
          console.log("🆕 Creating new user:", profile.displayName);
          const color = getRandomColor(profile.displayName);
          const avatar =
            profile.photos?.[0]?.value ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}&background=${color}&color=fff`;

          user = await new User({
            googleId: profile.id,
            displayName: profile.displayName,
            email: profile.emails[0].value,
            avatar: avatar,
            shareId: generateShareId(),
          }).save();

          // 2. Send Welcome Email
          if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            console.log("📨 Attempting to send welcome email to:", user.email);

            const mailOptions = {
              from: '"Nebula Chat" <' + process.env.EMAIL_USER + ">",
              to: user.email,
              subject: "Welcome to Nebula Chat! 🚀",
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #673AB7;">Welcome, ${user.displayName}!</h2>
                  <p>We are thrilled to have you on board. Your unique Share ID is:</p>
                  <h3 style="background: #f4f4f4; padding: 10px; display: inline-block;">${user.shareId}</h3>
                  <p>Share this ID with friends to start chatting!</p>
                  <br/>
                  <p>Best regards,<br/>The Nebula Team</p>
                </div>
              `,
            };

            // Send mail using Async/Await to catch errors better
            transporter.sendMail(mailOptions).then(info => {
               console.log("✅ Email Sent ID:", info.messageId);
            }).catch(emailError => {
               console.error("❌ Failed to send welcome email (Non-fatal):", emailError.message);
            });
          } else {
            console.log(
              "⚠️ Email credentials missing in .env, skipping welcome email.",
            );
          }
        } else {
          console.log("👋 Existing user logged in:", user.displayName);
        }

        done(null, user);
      } catch (err) {
        console.error("Auth Error:", err);
        done(err, null);
      }
    },
  ),
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) =>
  User.findById(id)
    .then((u) => done(null, u))
    .catch((e) => done(e, null)),
);

// --- FILE UPLOAD ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send({ error: "No file uploaded" });
  res.send({
    success: true,
    fileUrl: `/uploads/${req.file.filename}`,
    fileName: req.file.originalname,
  });
});

// --- API ROUTES ---

// Temp route to clear DB (USE WITH CAUTION)
app.get("/api/nuke-db", async (req, res) => {
  if (process.env.NODE_ENV === "production")
    return res.status(403).send("Not allowed in production");
  try {
    await User.deleteMany({});
    await Message.deleteMany({});
    res.send("💥 database cleared. All users and messages deleted.");
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Auth
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  }),
);
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => res.redirect(CLIENT_URL),
);
app.get("/api/logout", (req, res) => {
  req.logout(() => {
    res.redirect(CLIENT_URL);
  });
});

// User Data
app.get("/api/current_user", async (req, res) => {
  if (!req.user) return res.status(401).send(null);
  await User.findByIdAndUpdate(req.user._id, { lastSeen: new Date() });
  const userDoc = await User.findById(req.user._id).populate("contacts").lean();

  const lastMessagesAgg = await Message.aggregate([
    { $match: { $or: [{ sender: req.user._id }, { receiver: req.user._id }] } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: {
          $cond: [{ $eq: ["$sender", req.user._id] }, "$receiver", "$sender"],
        },
        lastMessageDoc: { $first: "$$ROOT" },
      },
    },
  ]);
  const lastMessageMap = {};
  lastMessagesAgg.forEach(
    (i) => (lastMessageMap[i._id.toString()] = i.lastMessageDoc),
  );
  const contactsWithMeta = userDoc.contacts.map((c) => ({
    ...c,
    lastMessageDoc: lastMessageMap[c._id.toString()] || null,
  }));
  res.send({ ...userDoc, contacts: contactsWithMeta });
});

app.put("/api/user/update", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Unauthorized" });
  try {
    const updated = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
    });
    res.send(updated);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.post("/api/contacts/add", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Unauthorized" });
  try {
    const userToAdd = await User.findOne({ shareId: req.body.targetShareId });
    if (!userToAdd) return res.status(404).send({ error: "User not found" });
    if (userToAdd._id.equals(req.user._id))
      return res.status(400).send({ error: "Cannot add yourself." });
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { contacts: userToAdd._id },
    });
    res.send(userToAdd);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.post("/api/messages/send", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Unauthorized" });
  const { receiverId, text, type, fileUrl, fileName, callDetails, replyTo } =
    req.body;
  if (!receiverId)
    return res.status(400).send({ error: "Receiver ID is required" });
  try {
    const newMessage = await new Message({
      sender: req.user._id,
      receiver: receiverId,
      text,
      type,
      fileUrl,
      fileName,
      callDetails,
      replyTo,
      timestamp: new Date(),
    }).save();
    res.send(newMessage);
    const receiverSocket = getUser(receiverId);
    if (receiverSocket) {
      io.to(receiverSocket.socketId).emit("getMessage", newMessage);
    }
  } catch (err) {
    console.error("Message Error:", err);
    res.status(500).send({ error: err.message });
  }
});

app.get("/api/messages/:contactId", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Unauthorized" });
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.contactId },
        { sender: req.params.contactId, receiver: req.user._id },
      ],
    }).sort({ timestamp: 1 });
    res.send(messages);
  } catch (e) {
    res.status(500).send(e);
  }
});

// --- ROOT REDIRECT ---
app.get("/", (req, res) => {
  res.redirect(CLIENT_URL);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));