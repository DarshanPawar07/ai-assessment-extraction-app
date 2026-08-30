import dotenv from "dotenv";

dotenv.config();

const GROQ_API_KEY =
  process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  throw new Error(
    "GROQ_API_KEY is missing. Add it to backend/.env."
  );
}

export const groqConfig = {
  apiKey: GROQ_API_KEY,
  model: "qwen/qwen3.6-27b",
};