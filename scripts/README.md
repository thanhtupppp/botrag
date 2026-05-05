# Test Scripts

Test pipeline end-to-end mà không cần chạy Next.js server.

## Setup

```bash
# Cài deps nếu chưa có
npm install

# Cần file .env.local với:
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
# GOOGLE_GENERATIVE_AI_API_KEY=
```

## Thứ tự chạy

### 1. Test embedding trước
```bash
npx tsx scripts/test-embed.ts
```
Kiểm tra:
- Gemini API key hợp lệ
- Embedding trả về đúng dimension 768
- Batch embed hoạt động

### 2. Test ingestion pipeline
```bash
npx tsx scripts/test-upload.ts
```
Kiểm tra:
- Insert document → Supabase
- Chunk text
- Embed batch
- Upsert chunks với vector
- `match_chunks` RPC trả về kết quả
- Tự cleanup sau khi test

### 3. Test chat pipeline
```bash
npx tsx scripts/test-chat.ts
```
Kiểm tra:
- Seed 1 document về chính sách hoàn tiền
- Hỏi 4 câu (3 trong tài liệu, 1 ngoài tài liệu)
- Verify retrieval score hợp lý
- Verify câu hỏi ngoài tài liệu → không có chunk nào score >= 0.3
- Tự cleanup sau khi test

## Expected Output

```
=== TEST: Gemini Embeddings ===
  ✅ Single embed OK — dimension: 768
  ✅ Batch embed OK — 3 vectors, all dimension: 768
✅ All embedding tests passed.

=== TEST: Upload / Ingestion Pipeline ===
  ✅ Document created: <uuid>
  ✅ 2 chunks created
  ✅ 2 embeddings returned, dimension: 768
  ✅ 2 chunks inserted
  ✅ Document status → ready
  ✅ match_chunks returned 2 results
✅ All ingestion tests passed!

=== TEST: RAG Chat Pipeline ===
  ✅ Seeded 6 chunks
  [Q] Tôi có thể hoàn tiền sau bao nhiêu ngày?
  Retrieved: 2 chunks (top score: 0.8xxx)
  Answer: Bạn có thể yêu cầu hoàn tiền trong vòng 30 ngày...
  [Q] Thời tiết hôm nay thế nào?
  ℹ️  No relevant chunks found (similarity < 0.3)
  → Expected: bot trả lời "không đủ thông tin"
✅ Chat pipeline test complete!
```

## Lưu ý

- Scripts dùng `SUPABASE_SERVICE_ROLE_KEY` — bypass RLS để test
- Tất cả test data đều được xóa sau khi chạy xong (cleanup block)
- `test-chat.ts` dùng `RETRIEVAL_QUERY` task type cho query embed (khác với `RETRIEVAL_DOCUMENT` cho indexing)
