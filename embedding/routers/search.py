from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    top_k: int = Field(default=5, ge=1, le=50)
    collection: str = "embeddings"
    where: Optional[Dict] = None


@router.post("/search")
async def search(body: SearchRequest, request: Request):
    tei = request.app.state.tei
    chroma = request.app.state.chroma
    try:
        query_embedding = await tei.embed_single(body.query)
    except Exception as e:
        raise HTTPException(502, f"TEI error: {e}")
    try:
        results = await chroma.query(body.collection, query_embedding, body.top_k, body.where)
    except Exception as e:
        raise HTTPException(502, f"ChromaDB error: {e}")
    return {"query": body.query, "total_results": len(results), "results": results}
