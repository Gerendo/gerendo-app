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
                <p>We store the minimum needed to make search work. For each tool you connect:</p>
                <ul className="flex flex-col gap-1.5 mt-3 ml-4">
                  <li><strong>Gmail</strong> - email subject, sender address, date, and the first ~1,500 characters of each email body. The full body is never stored - it is fetched live from Gmail only when you ask a question that needs it.</li>
                  <li><strong>Google Drive</strong> - file name, file type, and text chunks extracted from the content of your documents, sheets, and slides.</li>
                  <li><strong>Asana</strong> - task name, project name, assignee name, due date, status, and task description/comments.</li>
                </ul>
                <p className="mt-3">All of this is stored as searchable text and as vector embeddings (mathematical representations used for semantic search).</p>
                <p className="mt-2">We also store AI-generated summaries of emails once you request them, and workspace context used to make answers faster.</p>
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
                <p>Your data is stored in <strong>Supabase</strong>, a managed Postgres database hosted on AWS infrastructure in the EU (Ireland) region. All data is encrypted at rest using AES-256 and in transit over TLS 1.3.</p>
                <p className="mt-2">Your OAuth access tokens (which grant us read access to Gmail, Drive, and Asana) are stored in this same database. They are protected by row-level security - no other user, even in the same workspace, can read your tokens.</p>
              </>
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
                <p className="mt-3">Gerendo employees do not have access to your email content or documents in the normal course of operating the service. Database access is restricted to automated systems running the application.</p>
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
                  <li><strong>Voyage AI</strong> - text from your emails, files, and tasks is sent to Voyage's API to generate search embeddings. These embeddings are numerical vectors; Voyage does not receive your raw text after embedding.</li>
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
                <p className="mt-3">To permanently delete your account and all associated data, contact us at <a href="mailto:privacy@gerendo.com" style={{ color: accent }}>privacy@gerendo.com</a>. We will process account deletion within 7 days.</p>
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
