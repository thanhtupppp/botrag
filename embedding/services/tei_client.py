import httpx
from typing import List


class TEIClient:
    def __init__(self, base_url: str = "http://tei:80"):
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=60.0)

    async def embed(self, texts: List[str], normalize: bool = True) -> List[List[float]]:
        res = await self._client.post(
            f"{self.base_url}/embed",
            json={"inputs": texts, "normalize": normalize},
        )
        res.raise_for_status()
        return res.json()

    async def embed_single(self, text: str) -> List[float]:
        result = await self.embed([text])
        return result[0]

    async def health(self) -> dict:
        res = await self._client.get(f"{self.base_url}/health")
        res.raise_for_status()
        return res.json()

    async def info(self) -> dict:
        res = await self._client.get(f"{self.base_url}/info")
        res.raise_for_status()
        return res.json()

    async def close(self):
        await self._client.aclose()
