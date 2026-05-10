import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gerendo — a single brain for your agency",
  description:
    "Gerendo turns your agency's scattered tools — Gmail, Drive, Asana, WhatsApp — into one place your whole team can ask questions to, with cited answers.",
  icons: {
    icon: [
      { url: "/Gerendo-Favicon.png", type: "image/png" },
    ],
    apple: "/Gerendo-Favicon.png",
    shortcut: "/Gerendo-Favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} antialiased`}
    >
      <body>{children}</body>
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" precedence="default" />
      <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "74829cc5e584424cb58cbdbd373b5dd6"}' />
    </html>
  );
}
