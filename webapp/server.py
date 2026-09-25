"""NullTrace web server.

Serves the single-page hacker UI and a Server-Sent-Events endpoint that streams
per-site results live as each check completes.

Run locally:
    .venv/Scripts/python -m uvicorn webapp.server:app --host 127.0.0.1 --port 8080
Then expose it with Cloudflare Tunnel (see webapp/DEPLOY.md).
"""
import asyncio
import json
import os
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from webapp.runner import run_checks, is_email

STATIC_DIR = Path(__file__).parent / "static"

# Max concurrent scans across all visitors, so a shared deployment can't be
# turned into a high-volume enumeration engine.
MAX_INFLIGHT = int(os.environ.get("NULLTRACE_MAX_INFLIGHT", "3"))
TIMEOUT = int(os.environ.get("NULLTRACE_TIMEOUT", "15"))

app = FastAPI(title="NullTrace", docs_url=None, redoc_url=None, openapi_url=None)
_inflight = asyncio.Semaphore(MAX_INFLIGHT)


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/api/check")
async def check(email: str = Query(..., max_length=254)):
    email = email.strip().lower()
    if not is_email(email):
        return JSONResponse({"error": "invalid email"}, status_code=400)

    async def event_stream():
        # Reject politely if the box is already busy, instead of queueing forever.
        if _inflight.locked() and _inflight._value == 0:
            yield _sse({"type": "busy"})
            return
        async with _inflight:
            queue: asyncio.Queue = asyncio.Queue()
            producer = asyncio.create_task(
                run_checks(email, queue, timeout=TIMEOUT))
            try:
                while True:
                    item = await queue.get()
                    yield _sse(item)
                    if item.get("type") == "done":
                        break
            finally:
                producer.cancel()

    return StreamingResponse(event_stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})


def _sse(obj) -> str:
    return f"data: {json.dumps(obj)}\n\n"


# Serve any other static assets (favicon etc.) if added later.
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
