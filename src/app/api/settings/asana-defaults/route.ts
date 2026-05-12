import { NextResponse } from "next/server";
import { requireWorkspace, isErrorResponse } from "@/lib/get-workspace";
import { createServiceClient } from "@/lib/supabase-server";
import { getAsanaToken, asanaGet } from "@/lib/agency-db";

type Team = { gid: string; name: string };
type Workspace = { gid: string; name: string; teams: Team[] };

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function fetchAsanaWorkspaces(token: string): Promise<Workspace[]> {
  const workspaces = await withTimeout(asanaGet(token, "/workspaces"), 8000, "Asana /workspaces");
  const list: Array<{ gid: string; name: string }> = workspaces ?? [];

  const out = await Promise.all(
    list.map(async (ws) => {
      try {
        const t = await withTimeout(
          asanaGet(token, `/workspaces/${ws.gid}/teams?opt_fields=gid,name`),
          6000,
          `Asana teams for ${ws.gid}`
        );
        const teams: Team[] = (t ?? []).map((row: { gid: string; name: string }) => ({
          gid: row.gid,
          name: row.name,
        }));
        return { gid: ws.gid, name: ws.name, teams };
      } catch (err) {
        // 403 on personal workspaces and per-workspace timeouts both land here.
        // Workspace stays in the list but with zero teams.
        console.warn(`[asana-defaults] teams fetch failed for ${ws.gid}:`, err instanceof Error ? err.message : err);
        return { gid: ws.gid, name: ws.name, teams: [] as Team[] };
      }
    })
  );

  return out;
}

export async function GET(): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  let token: string;
  try {
    token = await getAsanaToken(workspaceId, userId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Asana not connected";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let workspaces: Workspace[];
  try {
    workspaces = await fetchAsanaWorkspaces(token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch Asana workspaces";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const supabase = createServiceClient();
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("asana_workspace_gid, asana_team_gid, asana_default_privacy")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const current = settings && settings.asana_workspace_gid && settings.asana_team_gid
    ? {
        asanaWorkspaceGid: settings.asana_workspace_gid as string,
        asanaTeamGid: settings.asana_team_gid as string,
        defaultPrivacy: (settings.asana_default_privacy as string) ?? "public_to_team",
      }
    : null;

  return NextResponse.json({ workspaces, current });
}

export async function POST(req: Request): Promise<NextResponse> {
  const _ws = await requireWorkspace();
  if (isErrorResponse(_ws)) return _ws;
  const { workspaceId, userId } = _ws;

  let body: { asanaWorkspaceGid?: unknown; asanaTeamGid?: unknown; defaultPrivacy?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const asanaWorkspaceGid = typeof body.asanaWorkspaceGid === "string" ? body.asanaWorkspaceGid : null;
  const asanaTeamGid = typeof body.asanaTeamGid === "string" ? body.asanaTeamGid : null;
  const defaultPrivacy = body.defaultPrivacy === "private" ? "private" : "public_to_team";

  if (!asanaWorkspaceGid || !asanaTeamGid) {
    return NextResponse.json({ error: "asanaWorkspaceGid and asanaTeamGid are required" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getAsanaToken(workspaceId, userId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Asana not connected";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Re-validate against live Asana data.
  let workspaces: Workspace[];
  try {
    workspaces = await fetchAsanaWorkspaces(token);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to validate Asana selection";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const matchedWorkspace = workspaces.find((w) => w.gid === asanaWorkspaceGid);
  if (!matchedWorkspace) {
    return NextResponse.json({ error: "Selected Asana workspace is not accessible to this user" }, { status: 400 });
  }
  const matchedTeam = matchedWorkspace.teams.find((t) => t.gid === asanaTeamGid);
  if (!matchedTeam) {
    return NextResponse.json({ error: "Selected Asana team is not in the chosen workspace" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("workspace_settings")
    .upsert(
      {
        workspace_id: workspaceId,
        asana_workspace_gid: asanaWorkspaceGid,
        asana_team_gid: asanaTeamGid,
        asana_default_privacy: defaultPrivacy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
