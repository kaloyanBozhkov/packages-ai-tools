import z, { ZodArray, ZodObject, ZodRecord } from "zod";
import { jsonrepair } from "jsonrepair";
import { getOpenAISFWInstance } from "./openai";

export const getLLMResponse = async <
  Schema extends ZodObject | ZodArray | ZodRecord
>({
  userMessage,
  systemMessage,
  schema,
}: {
  userMessage: string | string[];
  systemMessage: string;
  schema: Schema;
}): Promise<z.infer<Schema>> => {
  const openai = getOpenAISFWInstance();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
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
