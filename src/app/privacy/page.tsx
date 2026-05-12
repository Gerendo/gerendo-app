export default function PrivacyPage() {
  const accent = "oklch(0.78 0.14 65)";
  const muted = "oklch(0.65 0.015 60)";
  const dim = "oklch(0.55 0.012 60)";
  const border = "oklch(1 0 0 / 8%)";
  const card = "oklch(0.13 0.009 55)";

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.11 0.008 55)", color: "oklch(0.96 0.012 80)" }}>
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: border }}>
        <a href="/" className="hover:opacity-80 transition-opacity">
          <h1 className="text-xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Gerendo</h1>
        </a>
        <a href="/ask" className="text-sm transition-colors hover:opacity-80" style={{ color: muted }}>
          Back to app
        </a>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col gap-10">

        {/* Title */}
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            Privacy policy
          </h2>
          <p className="text-sm" style={{ color: dim }}>Last updated: May 10, 2026</p>
          <p className="text-sm mt-2" style={{ color: muted }}>
            Gerendo connects your agency's tools so you can ask questions across all of them. Because that means handling real emails, documents, and task data, we want to be completely transparent about what we store, how we protect it, and what you can do with it.
          </p>
        </div>

        {/* Sections */}
        {[
          {
            q: "What data do you store?",
            a: (
              <>
                <p>We store the minimum needed to make search and chat work. Here is exactly what is kept in our database:</p>
                <ul className="flex flex-col gap-1.5 mt-3 ml-4">
                  <li><strong>Gmail</strong> - email subject line, sender address and name, date, mailbox label, and the first ~1,500 characters of the email body as plain text. The full body beyond 1,500 characters is never stored - it is fetched live from Gmail only when a question needs it.</li>
                  <li><strong>Google Drive</strong> - file name, file type, and text chunks extracted from document content (plain text export of Docs, CSV of Sheets, text of Slides). Full file content is fetched live at query time, not stored.</li>
                  <li><strong>Asana</strong> - task name, project name, assignee display name, due date, completion status, notes, and comments. Stored as plain text and as search embeddings.</li>
                  <li><strong>Chat history</strong> - every question you ask and every answer the AI gives is stored in our database so you can return to past conversations. This includes the full text of both sides of the exchange.</li>
                  <li><strong>AI-generated summaries</strong> - when the AI summarises an email thread, that summary is stored to avoid re-generating it on repeat questions.</li>
                </ul>
                <p className="mt-3">For search to work, text from your emails, Drive files, and Asana tasks is also sent to Voyage AI to generate vector embeddings - mathematical representations stored alongside the text for semantic search. See the third-party section below.</p>
              </>
            ),
          },
          {
            q: "What do you NOT store?",
            a: (
              <ul className="flex flex-col gap-1.5 ml-4">
                <li>Full email bodies - fetched live from Gmail at query time, never written to our database</li>
                <li>Email attachments</li>
                <li>Full Google Drive file downloads (only extracted text chunks)</li>
                <li>Your Google or Asana passwords - we use OAuth, which means you authenticate directly with Google or Asana and give us a scoped access token</li>
                <li>Any data from tools you have not connected</li>
              </ul>
            ),
          },
          {
            q: "Where is data stored?",
            a: (
              <>
                <p>Your data is stored in <strong>Supabase</strong>, a managed Postgres database hosted on AWS infrastructure. All data is encrypted in transit over TLS 1.3. Sensitive content is additionally encrypted at the application layer before it reaches the database, with a key only Gerendo holds (see below).</p>
                <p className="mt-2">Each workspace's data is isolated by Postgres Row Level Security. RLS enforces tenant isolation. Application-layer encryption enforces operator isolation, even from the database operator.</p>
              </>
            ),
          },
          {
            q: "What is encrypted with a key only Gerendo holds?",
            a: (
              <>
                <ul className="flex flex-col gap-1.5 ml-4">
                  <li>Email subject lines and body content (after sync from Gmail)</li>
                  <li>Google Drive document content (after sync)</li>
                  <li>Asana task descriptions and comments (after sync)</li>
                  <li>AI-generated summaries derived from your data</li>
                  <li>Extracted facts (e.g., "Acme decided to launch May 25")</li>
                  <li>OAuth tokens for your connected tools</li>
                </ul>
                <p className="mt-3">These columns are encrypted with AES-256-GCM. The master key lives in our application's environment (Vercel), separate from the database. A Supabase staff member, a leaked database snapshot, or a compromised service-role token sees only ciphertext. We hold the key.</p>
              </>
            ),
          },
          {
            q: "What is stored as queryable metadata?",
            a: (
              <>
                <ul className="flex flex-col gap-1.5 ml-4">
                  <li>Email sender, recipient, timestamp, thread ID</li>
                  <li>Drive file name, type, modified timestamp</li>
                  <li>Asana task name, project name, assignee</li>
                  <li>Internal IDs, foreign keys, audit timestamps</li>
                </ul>
                <p className="mt-3">These fields are needed to display search results and join data across sources before any decryption happens. Encrypting them would require decrypting every row of every query, too expensive for our current size. We will revisit as customers and threat model evolve.</p>
              </>
            ),
          },
          {
            q: "How do chat queries actually work?",
            a: (
              <p>When you ask Gerendo a question, relevant snippets are decrypted in our application server (Vercel) and sent over TLS to our LLM provider (Anthropic Claude) for inference. Anthropic processes the prompt and returns an answer. Per Anthropic's standard commercial terms, prompts may be retained for up to 30 days for abuse monitoring. Anthropic does not train models on your data.</p>
            ),
          },
          {
            q: "The three layers, in plain English",
            a: (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: border }}>
                      <th className="py-2 pr-4 text-left font-semibold" style={{ color: "oklch(0.96 0.012 80)" }}>Layer</th>
                      <th className="py-2 pr-4 text-left font-semibold" style={{ color: "oklch(0.96 0.012 80)" }}>What</th>
                      <th className="py-2 text-left font-semibold" style={{ color: "oklch(0.96 0.012 80)" }}>Encryption</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b align-top" style={{ borderColor: border }}>
                      <td className="py-2 pr-4">At rest in Supabase</td>
                      <td className="py-2 pr-4">Body content, summaries, facts, OAuth tokens</td>
                      <td className="py-2">AES-256-GCM, key held by Gerendo</td>
                    </tr>
                    <tr className="border-b align-top" style={{ borderColor: border }}>
                      <td className="py-2 pr-4">In transit</td>
                      <td className="py-2 pr-4">All API traffic</td>
                      <td className="py-2">TLS 1.3</td>
                    </tr>
                    <tr className="align-top">
                      <td className="py-2 pr-4">During Claude inference</td>
                      <td className="py-2 pr-4">Decrypted snippets sent to Anthropic</td>
                      <td className="py-2">TLS 1.3, retained per Anthropic ToS up to 30 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            q: "What we deliberately do not claim",
            a: (
              <ul className="flex flex-col gap-1.5 ml-4">
                <li>We do not claim "zero-knowledge", we hold the encryption key.</li>
                <li>We do not claim "end-to-end encryption", that means only sender and recipient hold keys, which does not apply to a RAG product.</li>
                <li>We do not claim "even our engineers cannot read your messages" without context. During a chat query, the data is decrypted briefly in process memory. We claim <em>operator-level isolation</em> (the database operator cannot read it), not absolute isolation.</li>
              </ul>
            ),
          },
          {
            q: "Who can see my data?",
            a: (
              <>
                <p>Within your workspace, data isolation is enforced at the database level using Supabase Row Level Security (RLS):</p>
                <ul className="flex flex-col gap-1.5 mt-3 ml-4">
                  <li>Your personal emails and Drive files are visible only to you</li>
                  <li>Asana tasks sync per-user - other workspace members cannot see your personal task data</li>
                  <li>Workspace members cannot access each other's OAuth tokens or raw data</li>
                </ul>
                <p className="mt-3">Sensitive content (email bodies, AI summaries, extracted facts, OAuth tokens) is encrypted at the application layer with a key held by Gerendo, outside Supabase. A Gerendo or Supabase operator reading the database directly sees only ciphertext. During a chat query, the relevant snippets are decrypted briefly in process memory on our app server, then sent to Anthropic Claude over TLS. We claim operator-level isolation, not absolute isolation.</p>
              </>
            ),
          },
          {
            q: "Which third parties process my data?",
            a: (
              <>
                <p>When you use Gerendo, your data passes through these services:</p>
                <ul className="flex flex-col gap-1.5 mt-3 ml-4">
                  <li><strong>Anthropic (Claude)</strong> - your questions and relevant search results are sent to Anthropic's API to generate answers. Anthropic does not train models on API data by default.</li>
                  <li><strong>Voyage AI</strong> - text from your emails, files, and Asana tasks is sent to Voyage's API, which converts it into vector embeddings (numerical representations used for semantic search). Voyage receives the text as input to produce these vectors.</li>
                  <li><strong>Google</strong> - OAuth authentication and live data fetches (email bodies, Drive file content) go through Google's APIs.</li>
                  <li><strong>Asana</strong> - task data is read from Asana's API. Creating tasks from chat also writes through this API.</li>
                  <li><strong>Vercel</strong> - the application runs on Vercel's infrastructure. Request logs may include your user ID and query metadata.</li>
                </ul>
                <p className="mt-3">We do not sell your data to any third party, and we do not use your data for advertising.</p>
              </>
            ),
          },
          {
            q: "Can I delete my data?",
            a: (
              <>
                <p>Yes. From the app:</p>
                <ul className="flex flex-col gap-1.5 mt-3 ml-4">
                  <li><strong>Disconnect a tool</strong> - removes your OAuth token for that tool. Your indexed data is kept so reconnecting is fast and does not re-index everything.</li>
                  <li><strong>Delete all indexed data</strong> - available in Settings under Danger Zone. Permanently deletes all emails, files, and task data from our database and disconnects all tools. This cannot be undone.</li>
                </ul>
                <p className="mt-3">To fully remove your presence from Gerendo:</p>
                <ol className="flex flex-col gap-1.5 mt-2 ml-4 list-decimal">
                  <li>Use Settings → Danger Zone to delete all indexed data and disconnect all tools.</li>
                  <li>Revoke Gerendo's access in your Google account at <a href="https://myaccount.google.com/permissions" target="_blank" style={{ color: accent }}>myaccount.google.com/permissions</a>.</li>
                  <li>Email <a href="mailto:privacy@gerendo.com" style={{ color: accent }}>privacy@gerendo.com</a> to request removal of your workspace record. We will complete this within 7 days.</li>
                </ol>
              </>
            ),
          },
          {
            q: "How long is data retained?",
            a: (
              <>
                <p>Your data is retained as long as your account is active. If you delete your data using the Danger Zone button, it is removed immediately from our active database.</p>
                <p className="mt-2">Database backups are retained for up to 30 days by Supabase. Your data may remain in backup storage for up to 30 days after deletion from active systems.</p>
              </>
            ),
          },
          {
            q: "What permissions does Gerendo request from Google?",
            a: (
              <ul className="flex flex-col gap-1.5 ml-4">
                <li><strong>Gmail</strong> - read access to your email messages and metadata. We use this to index your inbox and fetch message bodies at query time. We do not send, delete, or modify emails.</li>
                <li><strong>Google Drive</strong> - read access to your files. We use this to read document content. We do not create, delete, or modify files. (Creating Asana tasks from Drive files does not write to Drive.)</li>
              </ul>
            ),
          },
          {
            q: "Does Gerendo read all my emails?",
            a: (
              <>
                <p>Only the labels you choose. When you first connect Gmail, a label picker lets you select which mailboxes to index. Inbox and Sent are selected by default. You can exclude any label (e.g. Promotions, Social).</p>
                <p className="mt-2">After initial sync, only new emails in those selected labels are processed - triggered by Google's push notification system, not by continuous polling.</p>
              </>
            ),
          },
          {
            q: "How do you handle security incidents?",
            a: (
              <p>If we become aware of a breach that affects your data, we will notify you by email within 72 hours and describe what happened, what data was affected, and what steps we are taking. Contact us immediately at <a href="mailto:security@gerendo.com" style={{ color: accent }}>security@gerendo.com</a> if you believe your account has been compromised.</p>
            ),
          },
          {
            q: "Contact",
            a: (
              <p>Questions about this policy or your data: <a href="mailto:privacy@gerendo.com" style={{ color: accent }}>privacy@gerendo.com</a></p>
            ),
          },
        ].map(({ q, a }) => (
          <div key={q} className="flex flex-col gap-3 p-5 rounded-2xl border" style={{ background: card, borderColor: border }}>
            <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>{q}</h3>
            <div className="text-sm flex flex-col gap-2 leading-relaxed" style={{ color: muted }}>
              {a}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
