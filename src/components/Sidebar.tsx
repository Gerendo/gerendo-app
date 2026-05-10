"use client";

import { useState, useEffect, useCallback } from "react";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
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

export default function Sidebar({ currentConversationId, onSelectConversation, onNewChat, collapsed, onToggleCollapse }: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadConversations = useCallback(() => {
    fetch("/api/conversations")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setConversations(data); })
      .catch(() => {});
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Reload when a new conversation is created
  useEffect(() => {
    if (currentConversationId) loadConversations();
  }, [currentConversationId, loadConversations]);

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
  const muted = "oklch(0.55 0.012 60)";
  const ember = "oklch(0.78 0.14 65)";

  return (
    <>
      {/* Sidebar panel */}
      <div
        className="flex-shrink-0 flex flex-col h-full transition-all duration-200 overflow-hidden border-r"
        style={{
          width: collapsed ? 0 : 260,
          borderColor: border,
          background: "oklch(0.13 0.009 55)",
        }}
      >
        <div className="flex flex-col h-full" style={{ width: 260, minWidth: 260 }}>
          {/* Top: logo + collapse */}
          <div className="flex items-center justify-between px-4 py-4 flex-shrink-0">
            <a href="/ask" className="text-base font-semibold tracking-tight hover:opacity-80 transition-opacity"
              style={{ fontFamily: "var(--font-display)" }}>
              Gerendo
            </a>
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-lg hover:opacity-70 transition-opacity"
              style={{ color: muted }}
              aria-label="Collapse sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
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
                      className="group relative flex items-center gap-1 px-3 py-2 rounded-xl cursor-pointer text-sm transition-colors"
                      style={{
                        background: currentConversationId === conv.id
                          ? "oklch(0.78 0.14 65 / 12%)"
                          : hoveredId === conv.id
                          ? "oklch(1 0 0 / 5%)"
                          : "transparent",
                        color: currentConversationId === conv.id
                          ? ember
                          : "oklch(0.75 0.01 60)",
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

          {/* Bottom nav */}
          <div className="flex-shrink-0 border-t px-3 py-3 flex flex-col gap-0.5" style={{ borderColor: border }}>
            {[
              { label: "Connect tools", href: "/connect" },
              { label: "Settings", href: "/settings" },
              { label: "Privacy", href: "/privacy", external: true },
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
            <a
              href="/api/auth/signout"
              className="flex items-center px-3 py-2 rounded-xl text-xs transition-colors hover:opacity-80"
              style={{ color: "oklch(0.45 0.01 60)" }}
            >
              Log out
            </a>
          </div>
        </div>
      </div>

      {/* Collapsed toggle button (shown when sidebar is closed) */}
      {collapsed && (
        <button
          onClick={onToggleCollapse}
          className="absolute left-3 top-4 z-10 p-1.5 rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: muted }}
          aria-label="Open sidebar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </>
  );
}
