import OpenAI from "openai";
import { aiPrompts } from "../services/aiPrompts";

// Reference: Using blueprint javascript_openai
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarizeText(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: aiPrompts.summarize() },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return result.summary;
  } catch (error: any) {
    console.error("[OpenAI] Erreur summarizeText:", error.message);
    throw new Error("Échec de la synthèse : " + error.message);
  }
}

export async function extractActions(text: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: aiPrompts.extractActions() },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return result.actions || [];
  } catch (error: any) {
    console.error("[OpenAI] Erreur extractActions:", error.message);
    throw new Error("Échec de l'extraction des actions : " + error.message);
  }
}

export async function classifyDocument(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: aiPrompts.classifyDocument() },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 100,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return result.category;
  } catch (error: any) {
    console.error("[OpenAI] Erreur classifyDocument:", error.message);
    throw new Error("Échec de la classification : " + error.message);
  }
}

export async function transcribeAudio(audioFilePath: string): Promise<{ text: string; duration: number }> {
  try {
    const fs = await import("fs");
    const audioReadStream = fs.createReadStream(audioFilePath);

    const transcription = await openai.audio.transcriptions.create({
      file: audioReadStream,
      model: "whisper-1",
    });

    return {
      text: transcription.text,
      duration: (transcription as any).duration || 0,
    };
  } catch (error: any) {
    console.error("[OpenAI] Erreur transcribeAudio:", error.message);
    throw new Error("Échec de la transcription audio : " + error.message);
  }
}

export async function suggestNextActions(clientHistory: string): Promise<string[]> {
  try {
    const clientName = clientHistory.split(",")[0]?.replace("Client: ", "").trim() || "ce client";
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: aiPrompts.suggestCrmActions({ clientName }),
        },
        { role: "user", content: clientHistory },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 300,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return result.suggestions || [];
  } catch (error: any) {
    console.error("[OpenAI] Erreur suggestNextActions:", error.message);
    throw new Error("Échec des suggestions CRM : " + error.message);
  }
}
