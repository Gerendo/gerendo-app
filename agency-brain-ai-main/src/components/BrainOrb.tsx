import { motion } from "framer-motion";

const NODES = [
  { x: 50, y: 50, label: "core", size: 8 },
  { x: 22, y: 28, label: "Gmail", size: 5 },
  { x: 78, y: 26, label: "Drive", size: 5 },
  { x: 18, y: 70, label: "Asana", size: 5 },
  { x: 82, y: 72, label: "Meet", size: 5 },
  { x: 50, y: 14, label: "WhatsApp", size: 5 },
  { x: 50, y: 88, label: "Discord", size: 5 },
  { x: 12, y: 50, label: "Notion", size: 4 },
  { x: 88, y: 50, label: "Slack", size: 4 },
];

export function BrainOrb({ className = "" }: { className?: string }) {
  return (
    <div className={`relative aspect-square ${className}`}>
      {/* glow */}
      <div className="absolute inset-[15%] rounded-full bg-ember/20 blur-3xl" />
      <div className="absolute inset-[30%] rounded-full bg-ember/30 blur-2xl" />

      <svg viewBox="0 0 100 100" className="relative h-full w-full">
        <defs>
          <radialGradient id="core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.85 0.14 65)" />
            <stop offset="60%" stopColor="oklch(0.68 0.16 50)" />
            <stop offset="100%" stopColor="oklch(0.4 0.1 40)" />
          </radialGradient>
          <filter id="soft">
            <feGaussianBlur stdDeviation="0.4" />
          </filter>
        </defs>

        {/* connecting lines */}
        {NODES.slice(1).map((n, i) => (
          <motion.line
            key={`l-${i}`}
            x1={50}
            y1={50}
            x2={n.x}
            y2={n.y}
            stroke="oklch(0.78 0.14 65)"
            strokeWidth={0.25}
            strokeOpacity={0.5}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0.2, 0.7, 0.2] }}
            transition={{
              pathLength: { duration: 1.2, delay: i * 0.1 },
              opacity: { duration: 3, delay: i * 0.2, repeat: Infinity, ease: "easeInOut" },
            }}
          />
        ))}

        {/* concentric rings */}
        {[20, 32, 44].map((r, i) => (
          <motion.circle
            key={`r-${i}`}
            cx={50}
            cy={50}
            r={r}
            fill="none"
            stroke="oklch(0.78 0.14 65)"
            strokeWidth={0.15}
            strokeOpacity={0.25}
            strokeDasharray="0.6 1.4"
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration: 30 + i * 10, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "50% 50%" }}
          />
        ))}

        {/* nodes */}
        {NODES.map((n, i) => (
          <g key={`n-${i}`}>
            {i === 0 ? (
              <circle cx={n.x} cy={n.y} r={n.size} fill="url(#core)" filter="url(#soft)" />
            ) : (
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={n.size / 2}
                fill="oklch(0.96 0.012 80)"
                animate={{ opacity: [0.4, 1, 0.4], r: [n.size / 2, n.size / 1.6, n.size / 2] }}
                transition={{ duration: 2.4, delay: i * 0.25, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </g>
        ))}

        {/* traveling pulse along one line */}
        {NODES.slice(1).map((n, i) => (
          <motion.circle
            key={`p-${i}`}
            r={0.7}
            fill="oklch(0.96 0.012 80)"
            initial={{ cx: n.x, cy: n.y, opacity: 0 }}
            animate={{ cx: [n.x, 50], cy: [n.y, 50], opacity: [0, 1, 0] }}
            transition={{ duration: 1.6, delay: i * 0.4, repeat: Infinity, repeatDelay: 2, ease: "easeIn" }}
          />
        ))}
      </svg>

      {/* labels */}
      {NODES.slice(1).map((n, i) => (
        <div
          key={`lab-${i}`}
          className="absolute font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          style={{
            left: `${n.x}%`,
            top: `${n.y}%`,
            transform: `translate(${n.x > 50 ? "12px" : "calc(-100% - 12px)"}, -50%)`,
          }}
        >
          {n.label}
        </div>
      ))}
    </div>
  );
}
