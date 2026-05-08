from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health(request: Request):
    tei = request.app.state.tei
    tei_ok, tei_info = False, {}
    try:
        tei_info = await tei.info()
        tei_ok = True
    except Exception as e:
        tei_info = {"error": str(e)}
    return {"status": "ok" if tei_ok else "degraded", "services": {"tei": {"ok": tei_ok, **tei_info}, "api": {"ok": True}}}
