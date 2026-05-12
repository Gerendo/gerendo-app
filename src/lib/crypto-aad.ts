// Additional Authenticated Data (AAD) builders for app-layer envelope
// encryption. Centralized here so the AAD format is consistent across all
// write sites and read sites (Day 3). Format is always:
//   {table}:{column}:{identity tuple stable across writes}
//
// The identity tuple must be computable from the row data at write time and
// must be stable across re-writes (upserts) of the same logical row. See
// /Users/mingw/.claude/plans/atomic-crafting-wreath.md for rationale.

export const aad = {
  embeddingsKeywordText: (workspaceId: string, messageId: number): string =>
    `embeddings:keyword_text:${workspaceId}:${messageId}`,

  driveEmbeddingsKeywordText: (
    workspaceId: string,
    fileId: number,
    chunkIndex: number
  ): string =>
    `drive_embeddings:keyword_text:${workspaceId}:${fileId}:${chunkIndex}`,

  asanaEmbeddingsKeywordText: (
    workspaceId: string,
    itemId: number,
    chunkIndex: number
  ): string =>
    `asana_embeddings:keyword_text:${workspaceId}:${itemId}:${chunkIndex}`,

  summariesSummary: (workspaceId: string, messageId: number): string =>
    `summaries:summary:${workspaceId}:${messageId}`,

  factsDetail: (
    workspaceId: string,
    messageId: number | null,
    type: string,
    subject: string | null
  ): string =>
    // Use ASCII Unit Separator (\x1f) between free-form fields because `type`
    // and `subject` are AI-generated and may contain colons. Other AAD
    // builders use integer/enum identity fields with no colon risk, so they
    // keep the simpler ":" join. Security review finding S5.
    `facts:detail\x1f${workspaceId}\x1f${messageId ?? "null"}\x1f${type}\x1f${subject ?? "null"}`,

  messagesSubject: (
    workspaceId: string,
    userId: string,
    source: string,
    externalId: string
  ): string =>
    `messages:subject:${workspaceId}:${userId}:${source}:${externalId}`,

  oauthTokensAccessToken: (
    workspaceId: string,
    userId: string,
    provider: string
  ): string =>
    `oauth_tokens:access_token:${workspaceId}:${userId}:${provider}`,

  oauthTokensRefreshToken: (
    workspaceId: string,
    userId: string,
    provider: string
  ): string =>
    `oauth_tokens:refresh_token:${workspaceId}:${userId}:${provider}`,
};
