import User from "../models/User.js";
import Message from "../models/Message.js";


export const getCurrentUser = async (req, res) => {
  if (!req.user) return res.status(401).send(null);

  await User.findByIdAndUpdate(req.user._id, { lastSeen: new Date() });

  const userDoc = await User.findById(req.user._id)
    .populate("contacts")
    .lean();

  const lastMessagesAgg = await Message.aggregate([
    { $match: { $or: [{ sender: req.user._id }, { receiver: req.user._id }] } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ["$sender", req.user._id] },
            "$receiver",
            "$sender",
          ],
        },
        lastMessageDoc: { $first: "$$ROOT" },
      },
    },
  ]);

  const lastMessageMap = {};
  lastMessagesAgg.forEach(
    (i) => (lastMessageMap[i._id.toString()] = i.lastMessageDoc)
  );

  const contactsWithMeta = userDoc.contacts.map((c) => ({
    ...c,
    lastMessageDoc: lastMessageMap[c._id.toString()] || null,
  }));

  res.send({ ...userDoc, contacts: contactsWithMeta });
};

export const updateUser = async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Unauthorized" });

  try {
    const updated = await User.findByIdAndUpdate(req.user._id, req.body, {
      new: true,
    });
    res.send(updated);
  } catch (e) {
    res.status(500).send(e);
  }
};