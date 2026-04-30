import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/Wordmark";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — Gerendo" },
      {
        name: "description",
        content: "How Gerendo uses cookies and similar technologies.",
      },
    ],
  }),
  component: Cookies,
});

const COOKIES = [
  {
    name: "__cf_bm",
    provider: "Cloudflare",
    purpose: "Bot management — distinguishes humans from bots to protect the site.",
    type: "Essential",
    duration: "30 minutes",
  },
  {
    name: "_cfuvid",
    provider: "Cloudflare",
    purpose: "Rate-limiting — used to identify individual clients behind a shared IP address.",
    type: "Essential",
    duration: "Session",
  },
  {
    name: "session / auth token",
    provider: "Gerendo",
    purpose: "Keeps you logged in across page loads.",
    type: "Essential",
    duration: "Until sign-out",
  },
  {
    name: "workspace_prefs",
    provider: "Gerendo",
    purpose: "Remembers UI preferences such as sidebar state and theme.",
    type: "Functional",
    duration: "1 year",
  },
];

function Cookies() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-8">
        <Link to="/">
          <Wordmark />
        </Link>
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          ← Back
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember">Legal</p>
        <h1 className="mt-4 font-display text-5xl tracking-tight">Cookie Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: April 2026</p>

        <div className="mt-12 space-y-12 text-[15px] leading-relaxed text-muted-foreground">

          {/* 1. What are cookies */}
          <section>
            <h2 className="font-display text-2xl text-foreground">What are cookies?</h2>
            <p className="mt-3">
              Cookies are small text files placed on your device by a website. They let the site
              remember information about your visit — such as your login state or preferences —
              across page loads and sessions.
            </p>
          </section>

          {/* 2. How we use cookies */}
          <section>
            <h2 className="font-display text-2xl text-foreground">How we use cookies</h2>
            <p className="mt-3">
              Gerendo uses only <strong className="text-foreground font-medium">essential</strong>{" "}
              and <strong className="text-foreground font-medium">functional</strong> cookies. We do
              not use advertising or cross-site tracking cookies. Our analytics are cookieless —
              Cloudflare Web Analytics collects aggregated, anonymous data (page views, countries,
              devices) without placing any cookie on your device.
            </p>
          </section>

          {/* 3. Cookie table */}
          <section>
            <h2 className="font-display text-2xl text-foreground">Cookies we set</h2>
            <p className="mt-3 mb-6">
              The table below lists every cookie that may be placed on your device when you use
              Gerendo.
            </p>

            {/* Mobile-friendly stacked cards */}
            <div className="space-y-3 sm:hidden">
              {COOKIES.map((c) => (
                <div key={c.name} className="rounded-lg border border-border p-4 space-y-1.5">
                  <p className="font-mono text-[12px] text-foreground">{c.name}</p>
                  <p className="text-[13px]">
                    <span className="text-foreground/60">Provider:</span> {c.provider}
                  </p>
                  <p className="text-[13px]">
                    <span className="text-foreground/60">Type:</span> {c.type}
                  </p>
                  <p className="text-[13px]">
                    <span className="text-foreground/60">Duration:</span> {c.duration}
                  </p>
                  <p className="text-[13px]">{c.purpose}</p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-foreground/60">
                      Cookie
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-foreground/60">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-foreground/60">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-foreground/60">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left font-mono text-[11px] uppercase tracking-wider text-foreground/60">
                      Purpose
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {COOKIES.map((c) => (
                    <tr key={c.name} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-[12px] text-foreground whitespace-nowrap">
                        {c.name}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{c.provider}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{c.type}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{c.duration}</td>
                      <td className="px-4 py-3">{c.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 4. Cloudflare */}
          <section>
            <h2 className="font-display text-2xl text-foreground">Cloudflare</h2>
            <p className="mt-3">
              Gerendo's infrastructure runs on Cloudflare. As part of their network security and
              performance services, Cloudflare may automatically set cookies (
              <span className="font-mono text-[12px] text-foreground">__cf_bm</span>,{" "}
              <span className="font-mono text-[12px] text-foreground">_cfuvid</span>) to protect
              the site against bots and to enforce rate limits. These are strictly necessary for
              the service to function securely. You can read more in{" "}

              <a href="https://www.cloudflare.com/cookie-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">
                Cloudflare's Cookie Policy
              </a>
              .
            </p>
          </section>

          {/* 5. No analytics cookies */}
          <section>
            <h2 className="font-display text-2xl text-foreground">Analytics</h2>
            <p className="mt-3">
              We use{" "}

              <a href="https://www.cloudflare.com/web-analytics/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">
                Cloudflare Web Analytics
              </a>
              , which is cookieless and privacy-preserving by design. It does not use cookies,
              does not fingerprint users, and does not share data with advertisers. No consent
              banner is required for this analytics tool.
            </p>
          </section>

          {/* 6. Your choices */}
          <section>
            <h2 className="font-display text-2xl text-foreground">Your choices</h2>
            <p className="mt-3">
              Because we only use essential and functional cookies, there is no cookie consent
              banner — these cookies are necessary for the service to work. You can delete or
              block cookies at any time through your browser settings, but doing so may prevent
              you from staying logged in or using certain features of Gerendo.
            </p>
            <p className="mt-3">
              For instructions on managing cookies in your browser, see the help pages for{" "}
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">Chrome</a>,{" "}
              <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">Firefox</a>,{" "}
              <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">Safari</a>, or{" "}
              <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-ember transition-colors">Edge</a>.
            </p>
          </section>

          {/* 7. Contact */}
          <section>
            <h2 className="font-display text-2xl text-foreground">Contact</h2>
            <p className="mt-3">
              Questions about this policy? Email us at{" "}

              <a href="mailto:privacy@gerendo.com"
                className="text-foreground underline underline-offset-2 hover:text-ember transition-colors"
              >
                privacy@gerendo.com
              </a>
              .
            </p>
          </section>

        </div>
      </main>
    </div>
  );
}