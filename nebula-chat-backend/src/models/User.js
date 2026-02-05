import mongoose from "mongoose";
const UserSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      index: true,
    },
    displayName: String,
    email: String,
    avatar: String,
    shareId: {
      type: String,
      unique: true,
      index: true,
    },
    bio: {
      type: String,
      default: "Hey! I am using Nebula Chat.",
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

const User = mongoose.model("User", UserSchema);
export default User;
