import z, { ZodArray, ZodObject, ZodRecord } from "zod";
import { jsonrepair } from "jsonrepair";
import type OpenAI from "openai";
import { getOpenRouterInstance } from "./openrouter";

type OpenRouterModel = OpenAI.ChatCompletionCreateParams["model"];

let cachedModels: string[] | null = null;

export const getOpenRouterModels = async (): Promise<string[]> => {
  if (cachedModels) return cachedModels;

  const openRouter = getOpenRouterInstance();
  const response = await openRouter.models.list();
  cachedModels = response.data.map((m) => m.id);
  return cachedModels;
};

export const getOpenRouterLLMResponse = async <
  Schema extends ZodObject | ZodArray | ZodRecord
>({
  userMessage,
  systemMessage,
  schema,
  model,
}: {
  userMessage: string | string[];
  systemMessage: string;
  schema: Schema;
  model: OpenRouterModel;
}): Promise<z.infer<Schema>> => {
  const availableModels = await getOpenRouterModels();
  if (!availableModels.includes(model)) {
    throw new Error(
      `Model "${model}" is not available on OpenRouter. Use getOpenRouterModels() to see available models.`
    );
  }

  const openRouter = getOpenRouterInstance();
  const response = await openRouter.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemMessage },
      ...(Array.isArray(userMessage)
        ? userMessage.map((message) => ({
            role: "user" as const,
            content: message,
          }))
        : [{ role: "user" as const, content: userMessage }]),
    ],
  });
  const responseText = response.choices[0].message.content;
  if (!responseText) {
    throw new Error("No response from LLM");
  }
  console.log("response before parsing", responseText);
  const parsedResponse = schema.parse(
    JSON.parse(jsonrepair(responseText))
  ) as z.infer<Schema>;
  return parsedResponse;
};
