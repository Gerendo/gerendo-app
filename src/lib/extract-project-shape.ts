import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `You are extracting structure for a new Asana project from an agency email decision.

You receive a one-sentence decision summary and a draft update comment.

Return JSON with these four fields:

{
  "project_name": "Customer or client name only (1-3 words). The proper noun referenced in the decision. Examples: \"Acme\", \"Skull Tattoo\", \"Temko Brand\". NEVER use placeholders like \"New project\".",
  "section_name": "Category of the decision (1-2 words). Examples: \"Launch\", \"Branding\", \"Budget\", \"Hiring\", \"Design\", \"Timeline\". Pick the natural category for this kind of work.",
  "task_name": "The specific decision as a short headline (3-8 words). Examples: \"Launch confirmed for May 25\", \"Budget approved at $50k\", \"Brand identity v2 locked in\". NEVER use placeholders like \"Decision logged\".",
  "due_date": "ISO date YYYY-MM-DD if a date is mentioned, else null. Example: \"2026-05-25\""
}

Be specific. Read the actual content. No markdown, no commentary, no code fences. JSON object only.`;

export type ProjectShape = {
  projectName: string;
  sectionName: string;
  taskName: string;
  dueOn: string | null;
};

// Strip leading/trailing markdown code fences. Sonnet sometimes wraps JSON in ```json ... ```
// despite the instruction not to.
function stripCodeFences(s: string): string {
  let out = s.trim();
  if (out.startsWith("```json")) out = out.slice(7);
  else if (out.startsWith("```")) out = out.slice(3);
  if (out.endsWith("```")) out = out.slice(0, -3);
  return out.trim();
}

// Pull the first 1-3 word capitalized proper noun out of the decision summary as a
// fallback project name. Skips a small set of common sentence-leading words so we
// don't pick up things like "The launch...".
function fallbackProjectNameFromSummary(summary: string): string {
  const SKIP = new Set([
    "The", "A", "An", "Our", "Their", "This", "That", "We", "I", "They", "He", "She",
    "It", "Today", "Tomorrow", "Yesterday", "Now",
  ]);
  // Find runs of 1-3 capitalized words.
  const re = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(summary)) !== null) {
    const phrase = match[1];
    const first = phrase.split(/\s+/)[0];
    if (!SKIP.has(first)) return phrase;
  }
  // Last resort: first 3 words.
  const words = summary.trim().split(/\s+/).slice(0, 3).join(" ");
  return words || "New project";
}

export async function extractProjectShape(
  decisionSummary: string,
  draftUpdate: string
): Promise<ProjectShape> {
  const userText = `Decision: ${decisionSummary}\n\nDraft update: ${draftUpdate}`;
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  // Log raw output before parsing so Vercel logs show what came back when things break.
  console.log("[extract-project-shape] raw sonnet output:", raw.slice(0, 500));

  const cleaned = stripCodeFences(raw);
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // Fall through with empty parsed; field-level fallbacks below handle it.
  }

  const rawProjectName =
    typeof parsed.project_name === "string" ? parsed.project_name.trim() : "";
  const rawSectionName =
    typeof parsed.section_name === "string" ? parsed.section_name.trim() : "";
  const rawTaskName =
    typeof parsed.task_name === "string" ? parsed.task_name.trim() : "";
  const rawDueDate =
    typeof parsed.due_date === "string" ? parsed.due_date.trim() : "";

  // Project name: never accept empty or literal "New project" fallback.
  let projectName = rawProjectName;
  if (!projectName || projectName.toLowerCase() === "new project") {
    projectName = fallbackProjectNameFromSummary(decisionSummary);
  }

  // Section name: default to "Decisions".
  const sectionName = rawSectionName || "Decisions";

  // Task name: never accept empty or literal "Decision logged" fallback.
  let taskName = rawTaskName;
  if (!taskName || taskName.toLowerCase() === "decision logged") {
    const trimmed = decisionSummary.trim();
    taskName = trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed || "Decision logged";
  }

  const dueOn = /^\d{4}-\d{2}-\d{2}$/.test(rawDueDate) ? rawDueDate : null;

  return { projectName, sectionName, taskName, dueOn };
}
