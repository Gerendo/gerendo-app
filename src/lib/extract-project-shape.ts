import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM = `You are helping an agency tool create a new Asana project from a detected decision in an email.

Given the decision summary and draft update, extract:
- project_name: short, capitalized client or project name (1 to 4 words). Examples: "Acme", "Acme Launch", "Skull Tattoo Brand"
- task_name: short task description (2 to 5 words). Examples: "Launch", "Brand identity v2", "Kickoff meeting"
- due_date: ISO date YYYY-MM-DD if a date is mentioned, else null. Examples: "2026-05-25"

Return JSON only, no markdown:
{
  "project_name": "...",
  "task_name": "...",
  "due_date": "YYYY-MM-DD or null"
}`;

export type ProjectShape = {
  projectName: string;
  taskName: string;
  dueOn: string | null;
};

export async function extractProjectShape(
  decisionSummary: string,
  draftUpdate: string
): Promise<ProjectShape> {
  const userText = `Decision: ${decisionSummary}\n\nDraft update: ${draftUpdate}`;
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userText }],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
  try {
    const parsed = JSON.parse(raw);
    return {
      projectName: typeof parsed.project_name === "string" ? parsed.project_name.trim() : "New project",
      taskName: typeof parsed.task_name === "string" ? parsed.task_name.trim() : "Decision logged",
      dueOn:
        typeof parsed.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.due_date)
          ? parsed.due_date
          : null,
    };
  } catch {
    return { projectName: "New project", taskName: "Decision logged", dueOn: null };
  }
}
