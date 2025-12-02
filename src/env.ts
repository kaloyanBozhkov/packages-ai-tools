import { z } from "zod";

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

const envSchema = z.object({
  OPEN_AI_API_KEY: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
