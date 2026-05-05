-- pgvector similarity search function
create or replace function match_chunks(
  query_embedding vector(768),
  match_count int default 5,
  filter_owner_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where
    (filter_owner_id is null or dc.owner_id = filter_owner_id)
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

-- RLS Policies: documents
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

-- RLS Policies: document_chunks
create policy "owner can select chunks"
  on document_chunks for select
  using (owner_id = auth.uid());

create policy "owner can insert chunks"
  on document_chunks for insert
  with check (owner_id = auth.uid());

create policy "owner can delete chunks"
  on document_chunks for delete
  using (owner_id = auth.uid());

-- RLS Policies: chat_sessions
create policy "owner can select sessions"
  on chat_sessions for select
  using (owner_id = auth.uid());

create policy "owner can insert sessions"
  on chat_sessions for insert
  with check (owner_id = auth.uid());

create policy "owner can delete sessions"
  on chat_sessions for delete
  using (owner_id = auth.uid());

-- RLS Policies: chat_messages (qua session)
create policy "owner can select messages"
  on chat_messages for select
  using (
    exists (
      select 1 from chat_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

create policy "owner can insert messages"
  on chat_messages for insert
  with check (
    exists (
      select 1 from chat_sessions s
      where s.id = session_id and s.owner_id = auth.uid()
    )
  );

-- RLS Policies: retrieval_logs
create policy "owner can select logs"
  on retrieval_logs for select
  using (owner_id = auth.uid());

create policy "owner can insert logs"
  on retrieval_logs for insert
  with check (owner_id = auth.uid());

-- RLS Policies: document_permissions
create policy "owner can manage permissions"
  on document_permissions for all
  using (
    exists (
      select 1 from documents d
      where d.id = document_id and d.owner_id = auth.uid()
    )
  );

create policy "shared users can select document"
  on documents for select
  using (
    exists (
      select 1 from document_permissions dp
      where dp.document_id = id and dp.user_id = auth.uid()
    )
  );

create policy "shared users can select chunks"
  on document_chunks for select
  using (
    exists (
      select 1 from document_permissions dp
      where dp.document_id = document_id and dp.user_id = auth.uid()
    )
  );
