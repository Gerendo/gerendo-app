import WaitlistForm from "./waitlist-form";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-20 sm:px-10 sm:py-28">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-14 flex items-center gap-2.5">
          <span className="inline-block h-3 w-3 rounded-full bg-accent" />
          <span
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Gerendo
          </span>
        </div>

        <h1
          className="mb-5 text-5xl leading-[1.05] font-semibold tracking-tight sm:text-6xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          A single brain for your agency.
        </h1>

        <p className="mb-12 max-w-xl text-lg leading-relaxed text-soft">
          Gerendo turns your scattered tools — Gmail, Drive, Asana, WhatsApp —
          into one place your whole team can ask questions to, with cited
          answers.
        </p>

        <ul className="mb-12 flex flex-col gap-4">
          <Feat title="Ask anything, get cited answers.">
            “What did Acme decide about the homepage?” — answered with links to
            the Gmail thread, WhatsApp message, and Asana comment.
          </Feat>
          <Feat title="Proactive drift alerts.">
            When a client says one thing in WhatsApp and your Asana task says
            another, we surface the conflict before it ships.
          </Feat>
          <Feat title="Onboarding compression.">
            New hires query your agency&apos;s full memory instead of
            interrupting senior staff. Days, not months.
          </Feat>
        </ul>

        <WaitlistForm />

        <p className="mt-6 text-sm text-muted">
          For 15–50 person marketing agencies. Phase 0 — talking to first design
          partners.
        </p>
      </div>
    </main>
  );
}

function Feat({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="relative pl-6 text-base leading-relaxed text-soft">
      <span className="absolute left-0 top-2.5 inline-block h-2 w-2 rounded-sm bg-accent" />
      <strong className="font-semibold text-fg">{title}</strong>{" "}
      {children}
    </li>
  );
}
