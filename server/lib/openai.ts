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

export interface FeedbackAiAnalysis {
  summary: string;
  detectedProblem: string;
  detectedNeed: string;
  sentiment: "positive" | "neutral" | "frustrated" | "angry" | "confused";
  urgency: "low" | "medium" | "high";
  productArea: string;
  keywords: string[];
  suggestedTags: string[];
  confidenceScore: number;
}

export async function analyzeFeedback(title: string, description: string, existingQualification?: { productArea?: string; tags?: string[]; importance?: string }): Promise<FeedbackAiAnalysis> {
  const context = existingQualification
    ? `\nQualification existante : zone produit="${existingQualification.productArea ?? "non renseignée"}", importance="${existingQualification.importance ?? "non renseignée"}", tags=[${(existingQualification.tags ?? []).join(", ")}]`
    : "";
  const userContent = `Titre du feedback : "${title}"\n\nDescription : "${description}"${context}`;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `Tu es un expert en product management qui analyse les feedbacks utilisateurs d'un outil SaaS pour freelances et product managers.
Ton rôle est d'extraire des insights structurés d'un feedback.

Réponds UNIQUEMENT en JSON valide avec exactement ces champs :
{
  "summary": "Résumé court du feedback en 1-2 phrases (max 150 caractères)",
  "detectedProblem": "Problème utilisateur principal identifié (max 120 caractères)",
  "detectedNeed": "Besoin sous-jacent de l'utilisateur (max 120 caractères)",
  "sentiment": "positive" | "neutral" | "frustrated" | "angry" | "confused",
  "urgency": "low" | "medium" | "high",
  "productArea": "Zone produit concernée (ex: Facturation, Onboarding, CRM, Trésorerie, Backlog, Roadmap, Dashboard, Exports, etc.)",
  "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3"],
  "suggestedTags": ["tag1", "tag2"],
  "confidenceScore": 0.85
}

Règles :
- sentiment doit être exactement l'une de ces valeurs : positive, neutral, frustrated, angry, confused
- urgency doit être exactement : low, medium ou high
- keywords : 3 à 5 mots-clés pertinents
- suggestedTags : 2 à 4 tags courts et réutilisables
- confidenceScore entre 0 et 1
- Réponds en français sauf pour les valeurs enum`,
        },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 400,
    });
    const raw = JSON.parse(response.choices[0].message.content!);
    const validSentiments = ["positive", "neutral", "frustrated", "angry", "confused"];
    const validUrgencies = ["low", "medium", "high"];
    return {
      summary: String(raw.summary ?? ""),
      detectedProblem: String(raw.detectedProblem ?? ""),
      detectedNeed: String(raw.detectedNeed ?? ""),
      sentiment: validSentiments.includes(raw.sentiment) ? raw.sentiment : "neutral",
      urgency: validUrgencies.includes(raw.urgency) ? raw.urgency : "medium",
      productArea: String(raw.productArea ?? ""),
      keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
      suggestedTags: Array.isArray(raw.suggestedTags) ? raw.suggestedTags.map(String) : [],
      confidenceScore: typeof raw.confidenceScore === "number" ? Math.min(1, Math.max(0, raw.confidenceScore)) : 0.7,
    };
  } catch (error: any) {
    console.error("[OpenAI] Erreur analyzeFeedback:", error.message);
    throw new Error("Échec de l'analyse du feedback : " + error.message);
  }
}

export async function generateFeedbackClusters(feedbacks: Array<{ id: string; title: string; description: string; type: string; importance: string; productArea?: string; tags?: string[] }>): Promise<Array<{
  title: string;
  description: string;
  detectedProblem: string;
  detectedNeed: string;
  productArea: string;
  sentiment: string;
  impactLevel: string;
  feedbackIds: string[];
  confidenceScore: number;
}>> {
  if (feedbacks.length === 0) return [];
  const feedbackList = feedbacks.map((f, i) =>
    `[${i + 1}] ID:${f.id} | Type:${f.type} | Importance:${f.importance} | Zone:${f.productArea ?? "?"} | Titre:"${f.title}" | Desc:"${f.description.slice(0, 150)}"`
  ).join("\n");
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `Tu es un expert en product management. Analyse ces feedbacks utilisateurs et regroupe-les en clusters thématiques cohérents.

Un cluster représente un signal produit consolidé : plusieurs feedbacks qui parlent du même problème ou besoin.
Ne crée un cluster que si tu as au moins 2 feedbacks similaires.
Un feedback peut appartenir à un seul cluster maximum.

Réponds UNIQUEMENT en JSON valide avec ce format :
{
  "clusters": [
    {
      "title": "Titre court du cluster (max 80 caractères)",
      "description": "Description du signal consolidé (max 200 caractères)",
      "detectedProblem": "Problème commun détecté",
      "detectedNeed": "Besoin sous-jacent commun",
      "productArea": "Zone produit principale",
      "sentiment": "positive" | "neutral" | "frustrated" | "angry" | "confused",
      "impactLevel": "low" | "medium" | "high" | "critical",
      "feedbackIds": ["uuid1", "uuid2"],
      "confidenceScore": 0.85
    }
  ]
}

Règles :
- Maximum 6 clusters
- feedbackIds doit contenir les IDs EXACTS fournis (après "ID:")
- sentiment : positive, neutral, frustrated, angry, confused
- impactLevel : low, medium, high, critical`,
        },
        { role: "user", content: `Feedbacks à analyser :\n${feedbackList}` },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1200,
    });
    const raw = JSON.parse(response.choices[0].message.content!);
    const validIds = new Set(feedbacks.map((f) => f.id));
    return (raw.clusters ?? []).map((c: any) => ({
      title: String(c.title ?? "Cluster sans titre"),
      description: String(c.description ?? ""),
      detectedProblem: String(c.detectedProblem ?? ""),
      detectedNeed: String(c.detectedNeed ?? ""),
      productArea: String(c.productArea ?? ""),
      sentiment: ["positive","neutral","frustrated","angry","confused"].includes(c.sentiment) ? c.sentiment : "neutral",
      impactLevel: ["low","medium","high","critical"].includes(c.impactLevel) ? c.impactLevel : "medium",
      feedbackIds: Array.isArray(c.feedbackIds) ? c.feedbackIds.filter((id: any) => validIds.has(id)) : [],
      confidenceScore: typeof c.confidenceScore === "number" ? Math.min(1, Math.max(0, c.confidenceScore)) : 0.7,
    })).filter((c: any) => c.feedbackIds.length >= 2);
  } catch (error: any) {
    console.error("[OpenAI] Erreur generateFeedbackClusters:", error.message);
    throw new Error("Échec de la génération de clusters : " + error.message);
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
