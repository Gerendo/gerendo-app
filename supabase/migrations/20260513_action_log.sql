create table if not exists action_log (
  id                bigserial primary key,
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  drift_finding_id  bigint references drift_findings(id) on delete set null,
  action_type       text not null,
  target_system     text not null,
  target_id         text,
  payload_before    jsonb,
  payload_after     jsonb,
  executed_by       uuid references auth.users(id) on delete set null,
  executed_at       timestamptz not null default now(),
  status            text not null default 'pending' check (status in ('pending','success','failed','undone'))
);

create index if not exists action_log_workspace_id_idx on action_log (workspace_id);
create index if not exists action_log_drift_finding_id_idx on action_log (drift_finding_id);
create index if not exists action_log_executed_by_idx on action_log (executed_by);

alter table action_log enable row level security;

create policy "users read own action_log"
  on action_log for select
  using (executed_by = auth.uid());

grant all on action_log to authenticated, service_role;
grant all on sequence action_log_id_seq to authenticated, service_role;
