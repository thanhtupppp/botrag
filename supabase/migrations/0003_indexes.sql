-- 0003_indexes.sql

-- 1. documents
create index if not exists idx_documents_owner_id
  on documents (owner_id);

-- 2. document_chunks
create index if not exists idx_document_chunks_owner_id
  on document_chunks (owner_id);

create index if not exists idx_document_chunks_document_id
  on document_chunks (document_id);

create index if not exists idx_document_chunks_document_chunk_index
  on document_chunks (document_id, chunk_index);

-- 3. chat_sessions
create index if not exists idx_chat_sessions_owner_id
  on chat_sessions (owner_id);

-- 4. retrieval_logs
create index if not exists idx_retrieval_logs_owner_id
  on retrieval_logs (owner_id);

-- 5. Vector index cho pgvector
create index if not exists idx_document_chunks_embedding
  on document_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- After creating vector index, refresh planner stats.
-- ANALYZE document_chunks;
