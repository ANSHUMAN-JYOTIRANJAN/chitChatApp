import "dotenv/config";
export const ENV = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  MONGO_URI: process.env.MONGO_URI,
  COOKIE_KEY: process.env.COOKIE_KEY,
  PORT: process.env.PORT,
  NODE_ENV:process.env.NODE_ENV,
  
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,

  VITE_API_URL: process.env.VITE_API_URL,
  CLIENT_URL: process.env.CLIENT_URL,
  SERVICE_URL: process.env.SERVICE_URL,

};
