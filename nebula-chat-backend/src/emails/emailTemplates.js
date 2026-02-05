// emails/emailTemplates.js
import { sendWelcomeEmail } from "./emails/emailHandler.js";
export function createWelcomeEmailTemplate(name, shareId) {
  const safeName = name?.replace(/[<>]/g, "") || "User";

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Welcome to Nebula Chat</title>
  </head>
  <body style="font-family: Arial, sans-serif; background:#f5f5f5; padding:20px;">
    <div style="max-width:600px;margin:auto;background:#ffffff;border-radius:10px;overflow:hidden;">
      
      <div style="background:#673AB7;color:white;padding:25px;text-align:center;">
        <h1 style="margin:0;">🚀 Welcome to Nebula Chat</h1>
      </div>

      <div style="padding:30px;color:#333;">
        <p style="font-size:16px;">Hey <strong>${safeName}</strong>,</p>

        <p>
          We're excited to have you on board! Your unique <strong>Share ID</strong> is:
        </p>

        <div style="background:#f4f4f4;padding:12px;border-radius:6px;
                    font-size:18px;text-align:center;font-weight:bold;">
          ${shareId}
        </div>

        <p style="margin-top:20px;">
          Share this ID with friends and start chatting instantly ✨
        </p>

        <p style="margin-top:30px;">
          Cheers,<br />
          <strong>The Nebula Team</strong>
        </p>
      </div>
    </div>
  </body>
  </html>
  `;
}
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
          console.log("🆕 Creating new user:", profile.displayName);

          const color = getRandomColor(profile.displayName);
          const avatar =
            profile.photos?.[0]?.value ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              profile.displayName,
            )}&background=${color}&color=fff`;

          user = await new User({
            googleId: profile.id,
            displayName: profile.displayName,
            email: profile.emails[0].value,
            avatar,
            shareId: generateShareId(),
          }).save();

          // ✅ Send welcome email (separated logic)
          await sendWelcomeEmail(
            user.email,
            user.displayName,
            user.shareId,
          );
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

