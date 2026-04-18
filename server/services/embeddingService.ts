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
