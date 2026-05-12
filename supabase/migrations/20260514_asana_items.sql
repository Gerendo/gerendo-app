create table if not exists asana_items (
  id              bigserial primary key,
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  external_id     text not null,
  type            text not null default 'task',
  name            text,
  project_name    text,
  assignee        text,
  due_date        date,
  status          text,
  notes           text,
  permalink_url   text,
  modified_at     bigint,
  synced_at       bigint,
  unique (workspace_id, user_id, external_id)
);

alter table asana_items enable row level security;

create policy "workspace members read own asana items"
  on asana_items for select
  using (user_id = auth.uid());

grant all on asana_items to authenticated, service_role;
grant all on sequence asana_items_id_seq to authenticated, service_role;
