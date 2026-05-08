from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from routers import embed, search, health
from services.tei_client import TEIClient
from services.chroma_client import ChromaService


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.tei = TEIClient(base_url=os.getenv("TEI_URL", "http://tei:80"))
    app.state.chroma = ChromaService(base_url=os.getenv("CHROMA_URL", "http://chromadb:8000"))
    print("[startup] TEI + ChromaDB clients initialized")
    yield
    await app.state.tei.close()


app = FastAPI(
    title="BotRAG Embedding API",
    description="Self-hosted chunking + embedding pipeline (BGE-M3 via TEI)",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["Health"])
app.include_router(embed.router, prefix="/embed", tags=["Embed"])
app.include_router(search.router, tags=["Search"])
