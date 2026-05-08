# Embedding Service

Self-hosted embedding pipeline chạy trong `botrag` stack.

## Services

| Service | Port | Mô tả |
|---|---|---|
| `embedding-api` | `8000` | FastAPI — chunking + embed + search |
| `tei` | `8080` | HuggingFace TEI — BGE-M3 model server |
| `chromadb` | `8001` | Vector store |

## Chạy

Từ root của `botrag`:

```bash
docker compose up --build
```

## API

### POST `/embed/text`
```bash
curl -X POST http://localhost:8000/embed/text \
  -H 'Content-Type: application/json' \
  -d '{"text": "Nội dung cần embed", "chunk_size": 512}'
```

### POST `/embed/batch`
```bash
curl -X POST http://localhost:8000/embed/batch \
  -H 'Content-Type: application/json' \
  -d '{"documents": [{"id": "doc1", "content": "..."}]}'
```

### POST `/search`
```bash
curl -X POST http://localhost:8000/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "câu hỏi", "top_k": 5}'
```

### GET `/health`
```bash
curl http://localhost:8000/health
```

## Biến môi trường (`.env`)

```env
TEI_MODEL=BAAI/bge-m3
CHUNK_SIZE=512
CHUNK_OVERLAP=64
BATCH_SIZE=32
```
