import Message from "../models/Message.js";
import { io} from "../lib/socket.js";

export const sendMessage = async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Unauthorized" });
  const { receiverId, text, type, fileUrl, fileName, callDetails, replyTo } =
    req.body;

  if (!receiverId)
    return res.status(400).send({ error: "Receiver ID is required" });

  try {
    const newMessage = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      text,
      type,
      fileUrl,
      fileName,
      callDetails,
      replyTo,
      timestamp: new Date(),
    });

    res.send(newMessage);

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("getMessage", newMessage);
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

export const getMessages = async (req, res) => {
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
};

