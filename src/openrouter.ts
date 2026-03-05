import { OpenRouter } from "@openrouter/sdk";
import { env } from "./env";

let openRouterInstance: OpenRouter | null = null;

export const getOpenRouterInstance = (): OpenRouter => {
  if (openRouterInstance === null) {
    openRouterInstance = new OpenRouter({
      apiKey: env.OPENROUTER_API_KEY,
    });
  }

  return openRouterInstance;
};
