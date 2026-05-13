"use client";

import { useState, useEffect, useRef } from "react";

interface UserInfo {
  name: string;
  email: string;
  avatar: string | null;
}

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/workspace/info")
      .then(r => r.json())
      .then(d => { if (d.currentUser) setUser(d.currentUser); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-opacity hover:opacity-80 overflow-hidden flex-shrink-0"
        style={{ background: "oklch(0.78 0.14 65)", color: "oklch(0.11 0.008 55)" }}
        aria-label="Account menu"
      >
        {initials}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 rounded-2xl border z-50 overflow-hidden"
          style={{ background: "oklch(0.16 0.01 55)", borderColor: "oklch(1 0 0 / 12%)" }}
        >
          {/* User info header */}
          {user && (
            <div className="px-4 py-3 border-b" style={{ borderColor: "oklch(1 0 0 / 8%)" }}>
              <p className="text-sm font-medium truncate" style={{ color: "oklch(0.96 0.012 80)" }}>
                {user.name}
              </p>
              <p className="text-xs truncate mt-0.5" style={{ color: "oklch(0.55 0.012 60)" }}>
                {user.email}
              </p>
            </div>
          )}

          {/* Nav links */}
          <div className="py-1">
            {[
              { label: "Ask questions", href: "/ask" },
              { label: "Connect tools", href: "/connect" },
              { label: "Settings", href: "/settings" },
            ].map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center px-4 py-2.5 text-sm transition-colors hover:opacity-80"
                style={{ color: "oklch(0.85 0.008 60)" }}
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t" style={{ borderColor: "oklch(1 0 0 / 8%)" }} />

          {/* Legal links */}
          <div className="py-1">
            <a
              href="https://gerendo.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:opacity-80"
              style={{ color: "oklch(0.55 0.012 60)" }}
            >
              Privacy policy
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-50">
                <path d="M2 10L10 2M10 2H4M10 2v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>

          {/* Divider */}
          <div className="border-t" style={{ borderColor: "oklch(1 0 0 / 8%)" }} />

          {/* Sign out */}
          <div className="py-1">
            <a
              href="/api/auth/signout"
              className="flex items-center px-4 py-2.5 text-sm transition-colors hover:opacity-80"
              style={{ color: "oklch(0.65 0.015 60)" }}
            >
              Log out
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
