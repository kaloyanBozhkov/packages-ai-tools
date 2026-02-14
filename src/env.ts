import { z } from "zod";

// Load environment variables from .env file
import dotenv from "dotenv";
dotenv.config();

const OPTIONAL_KEYS = ["OPEN_AI_API_KEY", "OPENROUTER_API_KEY"] as const;

const envSchema = z.object({
  OPEN_AI_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
});

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(_, prop: string) {
    const parsed = envSchema.parse(process.env);
    const value = parsed[prop as keyof z.infer<typeof envSchema>];
    if (
      OPTIONAL_KEYS.includes(prop as (typeof OPTIONAL_KEYS)[number]) &&
      (value === undefined || value === "")
    ) {
      console.warn(`[ai-tools] ${prop} environment variable is not set`);
    }
    return value;
  },
});
