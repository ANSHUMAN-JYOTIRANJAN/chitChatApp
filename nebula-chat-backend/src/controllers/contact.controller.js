import User from "../models/User.js";

export const addContact = async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Unauthorized" });

  try {
    const userToAdd = await User.findOne({
      shareId: req.body.targetShareId,
    });

    if (!userToAdd)
      return res.status(404).send({ error: "User not found" });

    if (userToAdd._id.equals(req.user._id))
      return res.status(400).send({ error: "Cannot add yourself." });

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { contacts: userToAdd._id },
    });

    res.send(userToAdd);
  } catch (e) {
    res.status(500).send(e);
  }
};
