import mongoose from "mongoose";
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
export default Message;