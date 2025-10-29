import OpenAI from "openai";

// Reference: Using blueprint javascript_openai
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarizeText(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise summaries. Summarize the following text while maintaining key points and decisions. Respond with JSON in this format: { 'summary': string }",
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return result.summary;
  } catch (error: any) {
    throw new Error("Failed to summarize text: " + error.message);
  }
}

export async function extractActions(text: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts action items from text. Identify tasks, decisions, and next steps. Respond with JSON in this format: { 'actions': string[] }",
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return result.actions || [];
  } catch (error: any) {
    throw new Error("Failed to extract actions: " + error.message);
  }
}

export async function classifyDocument(text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that classifies documents. Classify the document into one of these categories: legal, product, finance, technique, marketing, other. Respond with JSON in this format: { 'category': string }",
        },
        {
          role: "user",
          content: text,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 100,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return result.category;
  } catch (error: any) {
    throw new Error("Failed to classify document: " + error.message);
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
    throw new Error("Failed to transcribe audio: " + error.message);
  }
}

export async function suggestNextActions(clientHistory: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are a helpful CRM assistant. Based on client interaction history, suggest 2-3 relevant next actions. Respond with JSON in this format: { 'suggestions': string[] }",
        },
        {
          role: "user",
          content: clientHistory,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 300,
    });

    const result = JSON.parse(response.choices[0].message.content!);
    return result.suggestions || [];
  } catch (error: any) {
    throw new Error("Failed to suggest actions: " + error.message);
  }
}
