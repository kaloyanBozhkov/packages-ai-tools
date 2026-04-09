import type OpenAI from "openai";
import { getOpenAISFWInstance } from "./openai";

export const DEFAULT_VISION_EXTRACTION_PROMPT = `<about>
You are a vision extraction assistant. Your output is consumed downstream by a knowledge extraction pipeline that turns image contents into structured, searchable facts. Completeness and fidelity matter more than brevity or polish.
</about>

<instructions>
- Describe everything visible in the image as thoroughly as possible.
- Transcribe all text, labels, captions, axis values, legends, and annotations verbatim.
- Capture data shown in charts, tables, diagrams, and infographics, including numeric values and relationships.
- Identify people, objects, scenes, and any contextual cues (location, time of day, mood, activity).
- Note layout, structure, and spatial relationships when they carry meaning.
- Do not summarize, omit, speculate, or editorialize — be exhaustive and faithful to what is shown.
- If part of the image is unreadable or ambiguous, say so explicitly rather than guessing.
</instructions>

<output_format>
Plain text. No markdown headings or lists are required — write naturally, but cover every region of the image.
</output_format>`;

export type SupportedVisionMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/gif";

export type VisionContentPart =
  | { type: "text"; text: string }
  | {
      type: "image";
      imageBuffer: Buffer;
      mimeType: SupportedVisionMimeType;
    };

export const toOpenAIVisionContentParts = (
  parts: VisionContentPart[]
): OpenAI.ChatCompletionContentPart[] =>
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

const sliceForLog = (text: string, max = 80): string =>
  text.length > max
    ? `${text.slice(0, max)}…[+${text.length - max} chars]`
    : text;

export const stringifyMessagesForLog = (messages: unknown): string =>
  JSON.stringify(messages, (key, value) => {
    if (
      key === "url" &&
      typeof value === "string" &&
      value.startsWith("data:")
    ) {
      return sliceForLog(value);
    }
    return value;
  });

export const getLLMVisionResponse = async ({
  userMessage,
  systemMessage,
  model = "gpt-4o-mini",
}: {
  userMessage: string | VisionContentPart[];
  systemMessage?: string;
  model?: OpenAI.ChatCompletionCreateParams["model"];
}): Promise<string> => {
  const openai = getOpenAISFWInstance();

  const userContent: OpenAI.ChatCompletionUserMessageParam["content"] =
    typeof userMessage === "string"
      ? userMessage
      : toOpenAIVisionContentParts(userMessage);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    ...(systemMessage
      ? [{ role: "system" as const, content: systemMessage }]
      : []),
    { role: "user", content: userContent },
  ];

  console.log(
    "getLLMVisionResponse request:",
    stringifyMessagesForLog(messages)
  );

  const response = await openai.chat.completions.create({
    model,
    messages,
  });

  const responseText = response.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error("No response from LLM");
  }
  console.log("getLLMVisionResponse response:", responseText);
  return responseText;
};
