import { getOpenAISFWInstance } from "./openai";

export const getAudioTranscription = async (
  audioFileUrl: string,
  model: string = "gpt-4o-transcribe",
) => {
  console.log("audioFileUrl", audioFileUrl);
  const openai = getOpenAISFWInstance();
  const file = await fetch(audioFileUrl);
  const fileBlob = await file.blob();
  const namedBlob = new Blob([fileBlob], { type: fileBlob.type });
  Object.defineProperty(namedBlob, "name", {
    value: "userAudio.m4a",
  });
  const transcription = await openai.audio.transcriptions.create({
    file: namedBlob,
    model,
    response_format: "text",
  });
  return transcription;
};
