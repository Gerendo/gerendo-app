const ITEMS = [
  "Gmail", "Google Drive", "Asana", "Google Meet",
  "WhatsApp Business", "Discord", "Notion", "Slack",
  "Linear", "Calendar", "Loom", "Figma",
];

export function Marquee() {
  return (
    <div className="marquee-mask overflow-hidden border-y border-border/60 py-6">
      <div className="drift flex w-max gap-12 whitespace-nowrap">
        {[...ITEMS, ...ITEMS].map((item, i) => (
          <span
            key={i}
            className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/70"
          >
            <span className="mr-3 text-ember">◆</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
