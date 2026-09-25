"""Async runner for NullTrace.

Loads every nulltrace module and runs them concurrently under asyncio (the modules
only use httpx + stdlib, so no trio event loop is needed here). Results are
pushed onto an asyncio.Queue as each site finishes, which lets the web layer
stream them live to the browser.
"""
import asyncio
import re

import httpx

from nulltrace.core import import_submodules, get_functions

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")

_WEBSITES_CACHE = None


def is_email(email: str) -> bool:
    return bool(EMAIL_RE.fullmatch(email or ""))


def load_websites():
    """Discover module functions once and cache them."""
    global _WEBSITES_CACHE
    if _WEBSITES_CACHE is None:
        modules = import_submodules("nulltrace.modules")
        _WEBSITES_CACHE = get_functions(modules)
    return _WEBSITES_CACHE


def _category(fn) -> str:
    # nulltrace.modules.<category>.<name>
    parts = fn.__module__.split(".")
    return parts[2] if len(parts) > 2 else "other"


async def run_checks(email: str, queue: "asyncio.Queue", timeout: int = 15,
                     concurrency: int = 20):
    """Run all modules for `email`, streaming events onto `queue`.

    Event shapes (dicts):
      {"type": "start", "total": int}
      {"type": "result", "domain","name","category","status","extra"}
        status in {"used","free","blocked","error"}
      {"type": "done", "elapsed": float}
    """
    loop = asyncio.get_event_loop()
    start = loop.time()
    websites = load_websites()
    await queue.put({"type": "start", "total": len(websites)})

    sem = asyncio.Semaphore(concurrency)
    headers = {}

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True,
                                 headers=headers) as client:

        async def run_one(fn):
            name = fn.__name__
            out = []
            async with sem:
                try:
                    await fn(email, client, out)
                except Exception:
                    out = []
            if out:
                r = out[0]
                if r.get("error"):
                    status = "error"
                elif r.get("rateLimit"):
                    status = "blocked"
                elif r.get("exists"):
                    status = "used"
                else:
                    status = "free"
                domain = r.get("domain", name)
                extra = []
                if r.get("emailrecovery"):
                    extra.append(str(r["emailrecovery"]))
                if r.get("phoneNumber"):
                    extra.append(str(r["phoneNumber"]))
                others = r.get("others")
                if isinstance(others, dict):
                    if others.get("FullName"):
                        extra.append("name: " + str(others["FullName"]))
            else:
                status, domain, extra = "error", name, []

            await queue.put({
                "type": "result",
                "name": name,
                "domain": domain,
                "category": _category(fn),
                "status": status,
                "extra": " / ".join(extra),
            })

        await asyncio.gather(*(run_one(fn) for fn in websites))

    await queue.put({"type": "done", "elapsed": round(loop.time() - start, 2)})
