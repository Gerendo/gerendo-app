import { openAgencyDb, allEmbeddings, ftsSearch, getMessagesByEmbeddingIds } from "./agency-db";
import { embedTexts } from "./embed";

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type SearchResult = {
  embeddingId: number;
  source: string;
  externalId: string;
  sender: string;
  subject: string;
  receivedAt: number;
  threadId: string | null;
  gmailUrl: string;
  score: number;
};

export async function hybridSearch(query: string, limit = 5): Promise<SearchResult[]> {
  const db = openAgencyDb();

  // Embed the query
  const [queryEmbedding] = await embedTexts([query]);

  // Vector search - score all embeddings
  const allEmbs = allEmbeddings(db);
  const vectorScores = allEmbs.map((e) => ({
    id: e.id,
    score: cosineSimilarity(queryEmbedding, e.embedding),
  }));
  vectorScores.sort((a, b) => b.score - a.score);
  const topVector = vectorScores.slice(0, 20);

  // BM25 keyword search
  const bm25Results = ftsSearch(db, query, 20);

  // Reciprocal Rank Fusion
  const rrfScores = new Map<number, number>();
  const K = 60;

  topVector.forEach(({ id }, rank) => {
    rrfScores.set(id, (rrfScores.get(id) ?? 0) + 1 / (K + rank + 1));
  });

  bm25Results.forEach(({ id }, rank) => {
    rrfScores.set(id, (rrfScores.get(id) ?? 0) + 1 / (K + rank + 1));
  });

  // Sort by RRF score, take top N
  const ranked = Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const topIds = ranked.map(([id]) => id);
  const messages = getMessagesByEmbeddingIds(db, topIds);

  return ranked.map(([id, score]) => {
    const msg = messages.find((m: any) => m.embedding_id === id);
    if (!msg) return null;
    return {
      embeddingId: id,
      source: msg.source,
      externalId: msg.externalId,
      sender: msg.sender,
      subject: msg.subject,
      receivedAt: msg.receivedAt,
      threadId: msg.threadId,
      gmailUrl: `https://mail.google.com/mail/u/0/#all/${msg.threadId ?? msg.externalId}`,
      score,
    };
  }).filter(Boolean) as SearchResult[];
}
