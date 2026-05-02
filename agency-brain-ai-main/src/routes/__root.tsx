import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Gerendo — One brain for your whole business" },
      { name: "description", content: "Gerendo is your business's brain. One OS connecting every tool you use, remembering every decision, answering anything your team asks." },
      { name: "author", content: "Gerendo" },
      { property: "og:title", content: "Gerendo — One brain for your whole business" },
      { property: "og:description", content: "Gerendo is your business's brain. One OS connecting every tool you use, remembering every decision, answering anything your team asks." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://gerendo.com" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Gerendo — One brain for your whole business" },
      { name: "twitter:description", content: "Gerendo is your business's brain. One OS connecting every tool you use, remembering every decision, answering anything your team asks." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/Gerendo-Favicon.png",
      },
      {
        rel: "apple-touch-icon",
        href: "/Gerendo-Favicon.png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
