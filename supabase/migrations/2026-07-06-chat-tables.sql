-- chat sessions
create table chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  brand       text,
  title       text not null default '新会话',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index chat_sessions_user_idx on chat_sessions(user_id, updated_at desc);
alter table chat_sessions enable row level security;
create policy "user owns session" on chat_sessions
  for all using (auth.uid() = user_id);

-- chat messages
create table chat_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references chat_sessions(id) on delete cascade,
  role          text not null check (role in ('user','assistant','system')),
  content       text not null,
  status        text,
  created_at    timestamptz not null default now()
);
create index chat_messages_session_idx on chat_messages(session_id, created_at);
alter table chat_messages enable row level security;
create policy "user owns messages" on chat_messages
  for all using (
    exists (select 1 from chat_sessions s
            where s.id = chat_messages.session_id
              and s.user_id = auth.uid())
  );
