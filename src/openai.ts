import OpenAI from "openai";
import { env } from "./env";

let openAIInstance: OpenAI | null = null;

export const getOpenAISFWInstance = (): OpenAI => {
  if (openAIInstance === null) {
    openAIInstance = new OpenAI({
      apiKey: env.OPENAI_API_KEY,
    });
  }

  return openAIInstance;
};
