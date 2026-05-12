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

  // ── Phase 3a Bucket C: content/PII columns left plaintext in Phase 1+2 ──
  // All identity tuples here use enum/uuid/external-id fields with no colon
  // collision risk, so the simpler ":" join is safe. `source` is an enum
  // ("gmail" today); `external_id` and `source_external_id` are provider
  // IDs (Gmail message ids, Asana gids, Drive file ids) which don't contain
  // colons in practice.

  messagesSender: (
    workspaceId: string,
    userId: string,
    source: string,
    externalId: string
  ): string =>
    `messages:sender:${workspaceId}:${userId}:${source}:${externalId}`,

  messagesThreadId: (
    workspaceId: string,
    userId: string,
    source: string,
    externalId: string
  ): string =>
    `messages:thread_id:${workspaceId}:${userId}:${source}:${externalId}`,

  driveFilesName: (
    workspaceId: string,
    userId: string,
    externalId: string
  ): string =>
    `drive_files:name:${workspaceId}:${userId}:${externalId}`,

  asanaItemsName: (
    workspaceId: string,
    userId: string,
    externalId: string
  ): string =>
    `asana_items:name:${workspaceId}:${userId}:${externalId}`,

  asanaItemsProjectName: (
    workspaceId: string,
    userId: string,
    externalId: string
  ): string =>
    `asana_items:project_name:${workspaceId}:${userId}:${externalId}`,

  asanaItemsAssignee: (
    workspaceId: string,
    userId: string,
    externalId: string
  ): string =>
    `asana_items:assignee:${workspaceId}:${userId}:${externalId}`,

  asanaItemsNotes: (
    workspaceId: string,
    userId: string,
    externalId: string
  ): string =>
    `asana_items:notes:${workspaceId}:${userId}:${externalId}`,

  asanaItemsDueDate: (
    workspaceId: string,
    userId: string,
    externalId: string
  ): string =>
    `asana_items:due_date:${workspaceId}:${userId}:${externalId}`,

  asanaItemsPermalinkUrl: (
    workspaceId: string,
    userId: string,
    externalId: string
  ): string =>
    `asana_items:permalink_url:${workspaceId}:${userId}:${externalId}`,

  workspaceContextsContextText: (workspaceId: string): string =>
    `workspace_contexts:context_text:${workspaceId}`,

  driftFindingsDecisionSummary: (
    workspaceId: string,
    userId: string,
    source: string,
    sourceExternalId: string
  ): string =>
    `drift_findings:decision_summary:${workspaceId}:${userId}:${source}:${sourceExternalId}`,

  driftFindingsDraftUpdate: (
    workspaceId: string,
    userId: string,
    source: string,
    sourceExternalId: string
  ): string =>
    `drift_findings:draft_update:${workspaceId}:${userId}:${source}:${sourceExternalId}`,

  driftFindingsResolutionNote: (
    workspaceId: string,
    userId: string,
    source: string,
    sourceExternalId: string
  ): string =>
    `drift_findings:resolution_note:${workspaceId}:${userId}:${source}:${sourceExternalId}`,
};
