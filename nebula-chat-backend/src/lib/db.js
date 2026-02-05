import mongoose from "mongoose";
import { ENV } from "../lib/env.js";

export const connectDB = async () => {
  try {
    const { MONGO_URI } = ENV;

    if (!MONGO_URI) {
      throw new Error("MONGO_URI is not set properly");
    }

    const connection = await mongoose.connect(MONGO_URI);

    console.log("MongoDB Connected:", connection.connection.host);
  } catch (err) {
    console.error("Error connecting to MongoDB:", err.message);
    process.exit(1);
  }
};
