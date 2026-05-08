-- 0007_documents_schema_guard.sql
-- Defensive migration to ensure core RAG tables and RLS exist in every environment.

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

alter table documents enable row level security;
alter table document_chunks enable row level security;

-- Documents policies
 drop policy if exists "owner can select documents" on documents;
 drop policy if exists "owner can insert documents" on documents;
 drop policy if exists "owner can update documents" on documents;
 drop policy if exists "owner can delete documents" on documents;
 drop policy if exists "shared users can select document" on documents;

create policy "owner can select documents"
  on documents for select
  using (owner_id = auth.uid());

create policy "owner can insert documents"
  on documents for insert
  with check (owner_id = auth.uid());

create policy "owner can update documents"
  on documents for update
  using (owner_id = auth.uid());

create policy "owner can delete documents"
  on documents for delete
  using (owner_id = auth.uid());

create policy "shared users can select document"
  on documents for select
  using (
    exists (
      select 1
      from document_permissions dp
      where dp.document_id = id
        and dp.user_id = auth.uid()
    )
  );

-- Chunks policies
 drop policy if exists "owner can select chunks" on document_chunks;
 drop policy if exists "owner can insert chunks" on document_chunks;
 drop policy if exists "owner can delete chunks" on document_chunks;
 drop policy if exists "shared users can select chunks" on document_chunks;

create policy "owner can select chunks"
  on document_chunks for select
  using (owner_id = auth.uid());

create policy "owner can insert chunks"
  on document_chunks for insert
  with check (owner_id = auth.uid());

create policy "owner can delete chunks"
  on document_chunks for delete
  using (owner_id = auth.uid());

create policy "shared users can select chunks"
  on document_chunks for select
  using (
    exists (
      select 1
      from document_permissions dp
      where dp.document_id = document_id
        and dp.user_id = auth.uid()
    )
  );
