"use client";

import { useState, useEffect, useCallback } from "react";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface UserInfo {
  name: string;
  email: string;
}

interface SidebarProps {
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function groupByDate(convs: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const week = today - 7 * 86400000;
  const month = today - 30 * 86400000;

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Last 7 days", items: [] },
    { label: "Last 30 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const c of convs) {
    const t = new Date(c.updated_at).getTime();
    if (t >= today) groups[0].items.push(c);
    else if (t >= yesterday) groups[1].items.push(c);
    else if (t >= week) groups[2].items.push(c);
    else if (t >= month) groups[3].items.push(c);
    else groups[4].items.push(c);
  }

  return groups.filter(g => g.items.length > 0);
}

// Sidebar toggle icon — two vertical panels, left one highlighted
function SidebarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M6 1v16" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}

export default function Sidebar({ currentConversationId, onSelectConversation, onNewChat, collapsed, onToggleCollapse }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);

  const loadConversations = useCallback(() => {
    fetch("/api/conversations")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setConversations(data); })
      .catch(() => {});
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (currentConversationId) loadConversations();
  }, [currentConversationId, loadConversations]);

  useEffect(() => {
    fetch("/api/workspace/info")
      .then(r => r.json())
      .then(d => { if (d.currentUser) setUser(d.currentUser); })
      .catch(() => {});
  }, []);

  async function deleteConversation(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setDeletingId(id);
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) onNewChat();
    setDeletingId(null);
  }

  const groups = groupByDate(conversations);
  const border = "oklch(1 0 0 / 8%)";
  const muted = "oklch(0.72 0.012 60)";
  const ember = "oklch(0.78 0.14 65)";

  const initials = user?.name
    ? user.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <>
      {/* Sidebar panel */}
      <div
        className="flex-shrink-0 flex flex-col h-full transition-all duration-200 overflow-hidden border-r"
        style={{ width: collapsed ? 0 : 260, borderColor: border, background: "oklch(0.13 0.009 55)" }}
      >
        <div className="flex flex-col h-full" style={{ width: 260, minWidth: 260 }}>

          {/* Top: logo + collapse toggle */}
          <div className="flex items-center justify-between px-3 py-3 flex-shrink-0">
            <a href="/ask" className="px-1 text-base font-semibold tracking-tight hover:opacity-80 transition-opacity"
              style={{ fontFamily: "var(--font-display)" }}>
              Gerendo
            </a>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: muted }}
              aria-label="Collapse sidebar"
            >
              <SidebarIcon />
            </button>
          </div>

          {/* New chat button */}
          <div className="px-3 pb-3 flex-shrink-0">
            <button
              onClick={onNewChat}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors hover:opacity-90"
              style={{ background: ember, color: "oklch(0.11 0.008 55)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              New chat
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 [scrollbar-width:thin] [scrollbar-color:oklch(0.3_0_0)_transparent]">
            {conversations.length === 0 ? (
              <p className="px-3 py-4 text-xs" style={{ color: muted }}>No conversations yet. Ask your first question.</p>
            ) : (
              groups.map(group => (
                <div key={group.label} className="mb-3">
                  <p className="px-3 py-1 text-xs font-medium" style={{ color: muted }}>{group.label}</p>
                  {group.items.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => onSelectConversation(conv.id)}
                      onMouseEnter={() => setHoveredId(conv.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="relative flex items-center gap-1 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                      style={{
                        background: currentConversationId === conv.id
                          ? "oklch(0.78 0.14 65 / 12%)"
                          : hoveredId === conv.id ? "oklch(1 0 0 / 5%)" : "transparent",
                        color: currentConversationId === conv.id ? ember : "oklch(0.75 0.01 60)",
                      }}
                    >
                      <span className="flex-1 truncate text-xs leading-relaxed">{conv.title}</span>
                      {hoveredId === conv.id && (
                        <button
                          onClick={e => deleteConversation(e, conv.id)}
                          disabled={deletingId === conv.id}
                          className="flex-shrink-0 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
                          style={{ color: "oklch(0.62 0.22 25)" }}
                          aria-label="Delete conversation"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Bottom section: nav links + user avatar */}
          <div className="flex-shrink-0 border-t" style={{ borderColor: border }}>
            {/* Nav links */}
            <div className="px-3 pt-2 pb-1 flex flex-col gap-0.5">
              {[
                { label: "Connect tools", href: "/connect" },
                { label: "Settings", href: "/settings" },
                { label: "Privacy policy", href: "https://gerendo.com/privacy", external: true },
              ].map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  className="flex items-center px-3 py-2 rounded-xl text-xs transition-colors hover:opacity-80"
                  style={{ color: muted }}
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Divider */}
            <div className="mx-3 border-t" style={{ borderColor: border }} />

            {/* User row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{ background: ember, color: "oklch(0.11 0.008 55)" }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "oklch(0.85 0.008 60)" }}>
                  {user?.name ?? ""}
                </p>
                <p className="text-xs truncate" style={{ color: muted }}>
                  {user?.email ?? ""}
                </p>
              </div>
              <a
                href="/api/auth/signout"
                className="flex-shrink-0 p-1.5 rounded-lg hover:opacity-70 transition-opacity"
                style={{ color: muted }}
                aria-label="Log out"
                title="Log out"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5M9.5 10l3-3-3-3M13 7H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
          </div>

        </div>
      </div>

    </>
  );
}
