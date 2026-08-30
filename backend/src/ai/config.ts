import dotenv from "dotenv";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is missing. Add it to backend/.env."
  );
}

export const aiConfig = {
  geminiApiKey: GEMINI_API_KEY,
  model: "gemini-3.6-flash",
};