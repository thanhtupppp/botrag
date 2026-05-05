-- 0005_match_chunks_sharing.sql

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
    (
      filter_owner_id is null
      or dc.owner_id = filter_owner_id
      or exists (
        select 1
        from document_permissions p
        where p.document_id = dc.document_id
          and p.user_id = filter_owner_id
      )
    )
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
