create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  workspace_id uuid,
  title text not null,
  source_name text,
  mime_type text,
  storage_path text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  owner_id uuid not null,
  chunk_index int not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  workspace_id uuid,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists retrieval_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  owner_id uuid not null,
  query text not null,
  top_k jsonb not null default '[]'::jsonb,
  latency_ms int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists document_permissions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null,
  access_level text not null default 'read',
  created_at timestamptz not null default now(),
  unique(document_id, user_id)
);

alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table retrieval_logs enable row level security;
alter table document_permissions enable row level security;
