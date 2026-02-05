import User from "../models/User.js";
import Message from "../models/Message.js";

export const nukeDatabase = async (req, res) => {
  if (process.env.NODE_ENV == "production") {
    return res.status(403).send("NOT allowed in Production");
  }

  try {
    await User.deleteMany({});
    await Message.deleteMany({});
    res.send("database cleared. All users and messages deleted.");
  } catch (error) {
    res.status(500).send(error.Message);
  }
};
