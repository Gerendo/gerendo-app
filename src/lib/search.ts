import { semanticSearch, getMessagesByEmbeddingIds, semanticDriveSearch, getDriveFilesByEmbeddingIds, semanticAsanaSearch, getAsanaItemsByEmbeddingIds, type AgencyDb } from "./agency-db";
import { embedTexts } from "./embed";

export type SearchResult = {
  embeddingId: number;
  source: string;
  externalId: string;
  sender: string;
  subject: string;
  receivedAt: number;
  threadId: string | null;
  mailbox: string;
  gmailUrl: string;
  score: number;
};

export type AsanaSearchResult = {
  embeddingId: number;
  itemId: number;
  name: string;
  projectName: string | null;
  assignee: string | null;
  dueDate: string | null;
  status: string | null;
  permalinkUrl: string | null;
  snippet: string;
  score: number;
};

export type DriveSearchResult = {
  embeddingId: number;
  fileId: number;
  name: string;
  mimeType: string;
  webViewLink: string | null;
  chunkIndex: number;
  snippet: string;
  score: number;
};

// Encryption rollout (Day 4): FTS is disabled because tsvector cannot operate on
// encrypted bytea / NULL keyword_text. Retrieval is vector-only via Voyage-3.
// We fetch limit * 4 candidates so the caller's top-K stays well-populated, and
// derive score from vector rank as 1 / (rank + 1) (reciprocal rank). The exact
// number doesn't matter — callers only care about ordering.

export async function hybridSearch(query: string, limit = 5, db: AgencyDb): Promise<SearchResult[]> {
  const [queryEmbedding] = await embedTexts([query]);
  const queryVec = Array.from(queryEmbedding);

  const vectorResults = await semanticSearch(db, queryVec, limit * 4);

  const ranked = vectorResults
    .slice(0, limit)
    .map(({ id }, rank) => [id, 1 / (rank + 1)] as const);

  if (ranked.length === 0) return [];

  const messages = await getMessagesByEmbeddingIds(db, ranked.map(([id]) => id));

  return ranked.map(([id, score]) => {
    const msg = messages.find((m) => m.embeddingId === id);
    if (!msg) return null;
    return {
      embeddingId: id,
      source: msg.source,
      externalId: msg.externalId,
      sender: msg.sender,
      subject: msg.subject,
      receivedAt: msg.receivedAt,
      threadId: msg.threadId,
      mailbox: msg.mailbox ?? "inbox",
      gmailUrl: `https://mail.google.com/mail/u/0/#all/${msg.threadId ?? msg.externalId}`,
      score,
    };
  }).filter(Boolean) as SearchResult[];
}

export async function hybridAsanaSearch(query: string, limit = 5, db: AgencyDb): Promise<AsanaSearchResult[]> {
  const [queryEmbedding] = await embedTexts([query]);
  const queryVec = Array.from(queryEmbedding);

  const vectorResults = await semanticAsanaSearch(db, queryVec, limit * 4);

  const ranked = vectorResults
    .slice(0, limit)
    .map(({ id }, rank) => [id, 1 / (rank + 1)] as const);

  if (ranked.length === 0) return [];

  const items = await getAsanaItemsByEmbeddingIds(db, ranked.map(([id]) => id));
  return ranked.map(([id, score]) => {
    const item = items.find((i) => i.embeddingId === id);
    if (!item) return null;
    return {
      embeddingId: id,
      itemId: item.itemId,
      name: item.name,
      projectName: item.projectName,
      assignee: item.assignee,
      dueDate: item.dueDate,
      status: item.status,
      permalinkUrl: item.permalinkUrl,
      snippet: item.keywordText.slice(0, 200),
      score,
    };
  }).filter(Boolean) as AsanaSearchResult[];
}

export async function hybridDriveSearch(query: string, limit = 5, db: AgencyDb): Promise<DriveSearchResult[]> {
  const [queryEmbedding] = await embedTexts([query]);
  const queryVec = Array.from(queryEmbedding);

  const vectorResults = await semanticDriveSearch(db, queryVec, limit * 4);

  const ranked = vectorResults
    .slice(0, limit)
    .map(({ id }, rank) => [id, 1 / (rank + 1)] as const);

  if (ranked.length === 0) return [];

  const files = await getDriveFilesByEmbeddingIds(db, ranked.map(([id]) => id));

  return ranked.map(([id, score]) => {
    const f = files.find((f) => f.embeddingId === id);
    if (!f) return null;
    return {
      embeddingId: id,
      fileId: f.fileId,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink,
      chunkIndex: f.chunkIndex,
      snippet: f.keywordText.slice(0, 200),
      score,
    };
  }).filter(Boolean) as DriveSearchResult[];
}
