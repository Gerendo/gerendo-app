# Changelog

## [0.1.0.0] - 2026-05-09

### Added
- Supabase migration: all data now stored in Supabase (Postgres + pgvector) instead of local SQLite
- Google OAuth for Gmail, Google Drive, and Asana via direct OAuth 2.0 (no Nango dependency for data sources)
- Background Gmail sync job system with live progress polling - one click syncs everything
- Gmail batch API: fetches 100 emails per HTTP request (~10-20x faster than before)
- Google Drive integration: indexes Docs, Sheets, Slides with full text extraction and chunked embeddings
- Asana integration: indexes all tasks with comments, assignees, due dates, and project context
- Three-source hybrid search: queries Gmail + Drive + Asana simultaneously with RRF ranking
- `get_drive_file_content` tool: Claude can fetch full file content on demand
- `list_drive_files` tool: Claude can browse all indexed Drive files
- Markdown rendering in /ask UI via react-markdown + Tailwind typography
- Live knowledge base inventory shown on every query (email count, Drive files, Asana tasks)
- Workspace context auto-rebuilt after each sync

### Changed
- Removed Nango dependency for Gmail/Drive auth - direct OAuth tokens stored in Supabase
- Connect page redesigned with separate cards for Gmail, Drive, and Asana
- Ask page copy updated to reflect all three data sources
- System prompt updated: Claude identifies as Gerendo, cites sources inline

### Removed
- SQLite local database (better-sqlite3)
- Nango frontend SDK and branding widget
