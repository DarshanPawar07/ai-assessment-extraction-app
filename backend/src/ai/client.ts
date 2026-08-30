import { GoogleGenAI } from "@google/genai";
import { aiConfig } from "./config";

export const gemini = new GoogleGenAI({
  apiKey: aiConfig.geminiApiKey,
});

export const GEMINI_MODEL = aiConfig.model;