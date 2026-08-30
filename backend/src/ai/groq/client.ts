import Groq from "groq-sdk";

import { groqConfig } from "./config";

export const groq = new Groq({
  apiKey: groqConfig.apiKey,
});

export const GROQ_MODEL = groqConfig.model;