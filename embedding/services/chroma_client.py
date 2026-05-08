import httpx
from typing import List, Dict, Any, Optional
import uuid


class ChromaService:
    def __init__(self, base_url: str = "http://chromadb:8000"):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=30.0)
        self._api = f"{self.base_url}/api/v1"

    async def get_or_create_collection(self, name: str = "embeddings") -> str:
        res = await self._client.get(f"{self._api}/collections/{name}")
        if res.status_code == 200:
            return res.json()["id"]
        res = await self._client.post(
            f"{self._api}/collections",
            json={"name": name, "metadata": {"hnsw:space": "cosine"}},
        )
        res.raise_for_status()
        return res.json()["id"]

    async def upsert(
        self,
        collection_name: str,
        embeddings: List[List[float]],
        documents: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        ids: Optional[List[str]] = None,
    ) -> None:
        collection_id = await self.get_or_create_collection(collection_name)
        if ids is None:
            ids = [str(uuid.uuid4()) for _ in embeddings]
        if metadatas is None:
            metadatas = [{} for _ in embeddings]
        res = await self._client.post(
            f"{self._api}/collections/{collection_id}/upsert",
            json={"embeddings": embeddings, "documents": documents, "metadatas": metadatas, "ids": ids},
        )
        res.raise_for_status()

    async def query(
        self,
        collection_name: str,
        query_embedding: List[float],
        n_results: int = 5,
        where: Optional[Dict] = None,
    ) -> List[Dict[str, Any]]:
        collection_id = await self.get_or_create_collection(collection_name)
        payload: Dict[str, Any] = {
            "query_embeddings": [query_embedding],
            "n_results": n_results,
            "include": ["documents", "metadatas", "distances"],
        }
        if where:
            payload["where"] = where
        res = await self._client.post(f"{self._api}/collections/{collection_id}/query", json=payload)
        res.raise_for_status()
        data = res.json()
        return [
            {"content": doc, "metadata": data["metadatas"][0][i], "distance": data["distances"][0][i], "score": 1 - data["distances"][0][i]}
            for i, doc in enumerate(data["documents"][0])
        ]
