import type { OpenRouter } from "@openrouter/sdk";
import { getOpenRouterInstance } from "./openrouter";
import { getOpenRouterModels } from "./getOpenRouterLLMResponse";
import {
  stringifyMessagesForLog,
  type VisionContentPart,
} from "./getLLMVisionResponse";

type ChatSendParams = Parameters<OpenRouter["chat"]["send"]>[0];
type OpenRouterModel = ChatSendParams["chatGenerationParams"]["model"];
type OpenRouterMessages = ChatSendParams["chatGenerationParams"]["messages"];

const toOpenRouterVisionContentParts = (parts: VisionContentPart[]) =>
  parts.map((part) => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    }
    return {
      type: "image_url",
      image_url: {
        url: `data:${part.mimeType};base64,${part.imageBuffer.toString(
          "base64"
        )}`,
      },
    };
  });

export const getOpenRouterLLMVisionResponse = async ({
  userMessage,
  systemMessage,
  model,
}: {
  userMessage: string | VisionContentPart[];
  systemMessage?: string;
  model: OpenRouterModel;
}): Promise<string> => {
  const openRouter = getOpenRouterInstance();

  const userContent =
    typeof userMessage === "string"
      ? userMessage
      : toOpenRouterVisionContentParts(userMessage);

  const messages = [
    ...(systemMessage
      ? [{ role: "system" as const, content: systemMessage }]
      : []),
    { role: "user" as const, content: userContent },
  ];

  console.log(
    "getOpenRouterLLMVisionResponse request:",
    stringifyMessagesForLog(messages)
  );

  try {
    const response = await openRouter.chat.send({
      chatGenerationParams: {
        model,
        // OpenRouter SDK message types are narrower than the OpenAI-style
        // multimodal content blocks it accepts at runtime.
        messages: messages as unknown as OpenRouterMessages,
      },
    });
    const responseText = response.choices?.[0]?.message?.content;
    if (!responseText || typeof responseText !== "string") {
      throw new Error("No response from LLM");
    }
    console.log("getOpenRouterLLMVisionResponse response:", responseText);
    return responseText;
  } catch (err) {
    if (model) {
      const availableModels = await getOpenRouterModels();
      if (!availableModels.includes(model)) {
        throw new Error(
          `Model "${model}" is not available on OpenRouter. Use getOpenRouterModels() to see available models.`
        );
      }
    }
    throw err;
  }
};
