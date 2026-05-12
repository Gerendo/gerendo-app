create table if not exists workspace_settings (
  workspace_id            uuid primary key references workspaces(id) on delete cascade,
  asana_workspace_gid     text,
  asana_team_gid          text,
  asana_default_privacy   text not null default 'public_to_team',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table workspace_settings enable row level security;

create policy "workspace members read settings"
  on workspace_settings for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

grant all on workspace_settings to authenticated, service_role;
