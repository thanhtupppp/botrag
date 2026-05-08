from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from services.chunker import chunk_text

router = APIRouter()


class TextEmbedRequest(BaseModel):
    text: str
    chunk_size: int = Field(default=512, ge=64, le=2048)
    chunk_overlap: int = Field(default=64, ge=0, le=256)
    collection: str = Field(default="embeddings")
    metadata: Optional[Dict[str, Any]] = None
    save_to_store: bool = True


class BatchDocument(BaseModel):
    id: str
    content: str
    metadata: Optional[Dict[str, Any]] = None


class BatchEmbedRequest(BaseModel):
    documents: List[BatchDocument]
    chunk_size: int = Field(default=512, ge=64, le=2048)
    chunk_overlap: int = Field(default=64, ge=0, le=256)
    collection: str = "embeddings"
    save_to_store: bool = True


@router.post("/text")
async def embed_text(body: TextEmbedRequest, request: Request):
    tei = request.app.state.tei
    chroma = request.app.state.chroma

    chunks = chunk_text(body.text, body.chunk_size, body.chunk_overlap)
    if not chunks:
        raise HTTPException(400, "Text rỗng hoặc không chunk được")

    try:
        embeddings = await tei.embed([c.content for c in chunks])
    except Exception as e:
        raise HTTPException(502, f"TEI error: {e}")

    if body.save_to_store:
        meta_base = body.metadata or {}
        try:
            await chroma.upsert(
                body.collection, embeddings,
                [c.content for c in chunks],
                [{**meta_base, "chunk_index": c.index, "token_count": c.token_count} for c in chunks],
            )
        except Exception as e:
            raise HTTPException(502, f"ChromaDB error: {e}")

    return {
        "total_chunks": len(chunks),
        "chunks": [{"index": c.index, "content": c.content, "token_count": c.token_count, "embedding_dim": len(embeddings[i])} for i, c in enumerate(chunks)],
    }


@router.post("/batch")
async def embed_batch(body: BatchEmbedRequest, request: Request):
    tei = request.app.state.tei
    chroma = request.app.state.chroma
    all_chunks, all_embeddings, all_metadatas, all_ids = [], [], [], []

    for doc in body.documents:
        chunks = chunk_text(doc.content, body.chunk_size, body.chunk_overlap)
        if not chunks:
            continue
        try:
            embeddings = await tei.embed([c.content for c in chunks])
        except Exception as e:
            raise HTTPException(502, f"TEI error on {doc.id}: {e}")
        for c, emb in zip(chunks, embeddings):
            all_chunks.append({"doc_id": doc.id, "chunk": c})
            all_embeddings.append(emb)
            all_metadatas.append({**(doc.metadata or {}), "doc_id": doc.id, "chunk_index": c.index, "token_count": c.token_count})
            all_ids.append(f"{doc.id}__chunk_{c.index}")

    if not all_embeddings:
        raise HTTPException(400, "Không có chunk nào")

    if body.save_to_store:
        try:
            await chroma.upsert(body.collection, all_embeddings, [c["chunk"].content for c in all_chunks], all_metadatas, all_ids)
        except Exception as e:
            raise HTTPException(502, f"ChromaDB error: {e}")

    return {
        "total_documents": len(body.documents),
        "total_chunks": len(all_chunks),
        "chunks_per_doc": {doc.id: sum(1 for c in all_chunks if c["doc_id"] == doc.id) for doc in body.documents},
    }
