import { OpenRouterTextGenerationModel } from "./constants";
import { getOpenRouterInstance } from "./openrouter";
import { retry, logError } from "@koko420/shared";

const getExpandedQuery = async (text: string, systemMessage: string) => {
  const response = await getOpenRouterInstance().chat.completions.create({
    model: OpenRouterTextGenerationModel.GEMMA_3_27B_IT,
    temperature: 0,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: text },
    ],
  });

  const expandedText = response.choices[0]?.message?.content?.trim();

  if (!expandedText) {
    logError(
      {
        name: "embeddings.expandQuery",
        message: "No expanded text received from AI, returning original text",
      },
      { text }
    );
    return text;
  }

  return text + ", " + expandedText;
};

const DEFAULT_EXPAND_SYSTEM_MESSAGE = `This is for a NSFW platform. 

Please do prompt expansion on the following string. Just return a string with comma separated values. Use synonyms when there are one or two words, or rephrasing of the original text if there are more words. 

Return up to five different synonyms/rephrasings.`;

export const expandQuery = async (
  text: string,
  withRetry = false,
  getSystemMessage?: () => Promise<string> // custom system message to fetch
): Promise<string> => {
  try {
    const systemMessage = getSystemMessage
      ? await getSystemMessage()
      : DEFAULT_EXPAND_SYSTEM_MESSAGE;

    if (withRetry) {
      return retry(() => getExpandedQuery(text, systemMessage), 3);
    }

    return getExpandedQuery(text, systemMessage);
  } catch (error) {
    logError(
      {
        name: "embeddings.expandQuery",
        message: `Failed to expand query${withRetry ? " after 3 attempts" : ""}`,
      },
      { error }
    );
    return text;
  }
};
