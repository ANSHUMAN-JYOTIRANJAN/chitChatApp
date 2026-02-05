import nodemailer from "nodemailer";
import { createWelcomeEmailTemplate } from "./emailTemplates";

console.log(" Email Config Check:", {
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

transporter.verify((error) => {
  if (error) {
    console.log("Email server erro :", error);
  } else {
    console.log("Email server ready");
  }
});

export const sendWelcomeEmail = async (email, name, shareId) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("⚠️ Email credentials missing, skipping email.");
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Nebula Chat" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to Nebula Chat !",
      html: createWelcomeEmailTemplate(name, shareId),
    });
    console.log("Welcome email sent:", info.messageId);
  } catch (error) {
    console.error("❌ Failed to send welcome email:", err);
    throw err;
  }
};
