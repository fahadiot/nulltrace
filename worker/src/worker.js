// NullTrace — Cloudflare Worker.
// Serves the static UI (via the ASSETS binding) and a Server-Sent-Events
// endpoint that runs every site check concurrently and streams results live.
import { SITES } from "./sites.js";

const PER_CHECK_TIMEOUT_MS = 12000;
const CONCURRENCY = 12;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return json({ ok: true, sites: SITES.length });
    }

    if (url.pathname === "/api/check") {
      return handleCheck(url);
    }

    // Everything else -> static assets (index.html at "/").
    return env.ASSETS.fetch(request);
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function handleCheck(url) {
  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: "invalid email" }, 400);
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const send = (obj) => writer.write(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

  (async () => {
    const start = Date.now();
    await send({ type: "start", total: SITES.length });

    let i = 0;
    async function worker() {
      while (i < SITES.length) {
        const site = SITES[i++];
        const r = await runOne(site, email);
        await send({
          type: "result",
          name: site.name,
          domain: site.domain,
          category: site.category || "other",
          status: r.status,
          extra: r.extra || "",
        });
      }
    }
    const pool = [];
    for (let k = 0; k < Math.min(CONCURRENCY, SITES.length); k++) pool.push(worker());
    await Promise.all(pool);

    await send({ type: "done", elapsed: ((Date.now() - start) / 1000).toFixed(2) });
    await writer.close();
  })();

  return new Response(stream.readable, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    },
  });
}

async function runOne(site, email) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), PER_CHECK_TIMEOUT_MS);
  try {
    const res = await site.check(email, ctrl.signal);
    // check() returns {status, extra?} or {exists:bool, extra?}
    if (res && res.status) return res;
    if (res && typeof res.exists === "boolean") {
      return { status: res.exists ? "used" : "free", extra: res.extra };
    }
    return { status: "blocked" };
  } catch (e) {
    return { status: "blocked" };
  } finally {
    clearTimeout(t);
  }
}
