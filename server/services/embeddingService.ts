import OpenAI from "openai";
import { db } from "../db";
import { sql } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function initNoteEmbeddingsTable(): Promise<void> {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS note_embeddings (
        note_id UUID PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        embedding vector(1536),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS note_embeddings_account_idx ON note_embeddings(account_id)
    `);
    console.log("[EmbeddingService] note_embeddings table ready");
  } catch (err) {
    console.error("[EmbeddingService] Failed to initialize note_embeddings table:", err);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text.slice(0, 8000),
  });
  return response.data[0].embedding;
}

export async function upsertNoteEmbedding(noteId: string, accountId: string, text: string): Promise<void> {
  try {
    if (!text?.trim()) return;
    const embedding = await generateEmbedding(text);
    const vectorStr = `[${embedding.join(",")}]`;
    await db.execute(sql`
      INSERT INTO note_embeddings (note_id, account_id, embedding, updated_at)
      VALUES (${noteId}, ${accountId}, ${vectorStr}::vector, NOW())
      ON CONFLICT (note_id)
      DO UPDATE SET embedding = ${vectorStr}::vector, updated_at = NOW()
    `);
  } catch (err) {
    console.error(`[EmbeddingService] Failed to upsert embedding for note ${noteId}:`, err);
  }
}

export async function initFeedbackEmbeddingsTable(): Promise<void> {
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS feedback_embeddings (
        feedback_id UUID PRIMARY KEY REFERENCES project_feedbacks(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        backlog_id UUID REFERENCES backlogs(id) ON DELETE CASCADE,
        embedding vector(1536),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS feedback_embeddings_account_idx ON feedback_embeddings(account_id)
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS feedback_embeddings_backlog_idx ON feedback_embeddings(backlog_id)
    `);
    console.log("[EmbeddingService] feedback_embeddings table ready");
  } catch (err) {
    console.error("[EmbeddingService] Failed to initialize feedback_embeddings table:", err);
    throw err;
  }
}

export async function upsertFeedbackEmbedding(
  feedbackId: string,
  accountId: string,
  backlogId: string,
  text: string
): Promise<void> {
  try {
    if (!text?.trim()) return;
    const embedding = await generateEmbedding(text);
    const vectorStr = `[${embedding.join(",")}]`;
    await db.execute(sql`
      INSERT INTO feedback_embeddings (feedback_id, account_id, backlog_id, embedding, updated_at)
      VALUES (${feedbackId}, ${accountId}, ${backlogId}, ${vectorStr}::vector, NOW())
      ON CONFLICT (feedback_id)
      DO UPDATE SET embedding = ${vectorStr}::vector, updated_at = NOW()
    `);
  } catch (err) {
    console.error(`[EmbeddingService] Failed to upsert embedding for feedback ${feedbackId}:`, err);
  }
}

export interface SimilarFeedback {
  feedbackId: string;
  title: string;
  similarity: number;
}

export interface SimilarFeedbackResult {
  matches: SimilarFeedback[];
  embedding: number[];
}

export async function searchSimilarFeedbacks(
  queryText: string,
  accountId: string,
  backlogId: string,
  excludeFeedbackId: string | null,
  limit = 10,
  threshold = 0.85
): Promise<SimilarFeedbackResult> {
  const embedding = await generateEmbedding(queryText);
  const vectorStr = `[${embedding.join(",")}]`;

  const excludeClause = excludeFeedbackId
    ? sql`AND fe.feedback_id != ${excludeFeedbackId}`
    : sql``;

  const rows = await db.execute(sql`
    SELECT
      fe.feedback_id,
      pf.title,
      1 - (fe.embedding <=> ${vectorStr}::vector) AS similarity
    FROM feedback_embeddings fe
    JOIN project_feedbacks pf ON pf.id = fe.feedback_id
    WHERE fe.account_id = ${accountId}
      AND fe.backlog_id = ${backlogId}
      AND pf.internal_status != 'archived'
      ${excludeClause}
    ORDER BY fe.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `);

  const matches = (rows as any[])
    .filter((row) => parseFloat(row.similarity) >= threshold)
    .map((row) => ({
      feedbackId: row.feedback_id,
      title: row.title || "",
      similarity: parseFloat(row.similarity) || 0,
    }));

  return { matches, embedding };
}

export async function saveFeedbackEmbedding(
  feedbackId: string,
  accountId: string,
  backlogId: string,
  embedding: number[]
): Promise<void> {
  try {
    const vectorStr = `[${embedding.join(",")}]`;
    await db.execute(sql`
      INSERT INTO feedback_embeddings (feedback_id, account_id, backlog_id, embedding, updated_at)
      VALUES (${feedbackId}, ${accountId}, ${backlogId}, ${vectorStr}::vector, NOW())
      ON CONFLICT (feedback_id)
      DO UPDATE SET embedding = ${vectorStr}::vector, updated_at = NOW()
    `);
  } catch (err) {
    console.error(`[EmbeddingService] Failed to save embedding for feedback ${feedbackId}:`, err);
  }
}

export interface SimilarNote {
  noteId: string;
  title: string;
  snippet: string;
  similarity: number;
}

export async function searchSimilarNotes(
  queryText: string,
  accountId: string,
  limit = 5
): Promise<SimilarNote[]> {
  try {
    const embedding = await generateEmbedding(queryText);
    const vectorStr = `[${embedding.join(",")}]`;

    const rows = await db.execute(sql`
      SELECT
        ne.note_id,
        n.title,
        n.plain_text,
        1 - (ne.embedding <=> ${vectorStr}::vector) AS similarity
      FROM note_embeddings ne
      JOIN notes n ON n.id = ne.note_id
      WHERE ne.account_id = ${accountId}
        AND n.status != 'archived'
      ORDER BY ne.embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `);

    return (rows as any[])
      .filter((row) => parseFloat(row.similarity) > 0.7)
      .map((row) => ({
        noteId: row.note_id,
        title: row.title || "Sans titre",
        snippet: (row.plain_text || "").slice(0, 400),
        similarity: parseFloat(row.similarity) || 0,
      }));
  } catch (err) {
    console.error("[EmbeddingService] Failed to search similar notes:", err);
    return [];
  }
}
