create table if not exists drift_findings (
  id                  bigserial primary key,
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  source              text not null,
  source_external_id  text not null,
  detected_at         timestamptz not null default now(),
  decision_summary    text not null,
  draft_update        text not null,
  asana_item_id       bigint references asana_items(id) on delete set null,
  status              text not null default 'pending',
  resolved_at         timestamptz,
  resolution_note     text,
  unique (source, source_external_id, workspace_id)
);

alter table drift_findings enable row level security;

create policy "workspace members read own findings"
  on drift_findings for select
  using (user_id = auth.uid());

grant all on drift_findings to authenticated, service_role;
grant all on sequence drift_findings_id_seq to authenticated, service_role;
