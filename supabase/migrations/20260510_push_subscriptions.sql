create table if not exists push_subscriptions (
  id          bigserial primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth         text not null,
  device_type  text not null default 'browser',
  created_at   timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy "users manage own push subscriptions"
  on push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
