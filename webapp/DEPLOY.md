# Deploying NullTrace on your Cloudflare

NullTrace is a small Python web service (the hacker UI **and** the scan API in one
process). Cloudflare Workers/Pages can't run Python that makes dozens of live
outbound requests, so the clean, permanent setup is:

```
[ visitors ] --> Cloudflare edge --> Cloudflare Tunnel --> uvicorn (NullTrace) on your machine/VPS
```

You keep one Python process running and expose it through a **named Cloudflare
Tunnel** at a subdomain of your domain. No inbound ports, no public IP needed.

> ℹ️  I can't log into your Cloudflare account from here — the `cloudflared tunnel login`
> step below opens your browser so **you** sign in as `fahadstudyy@gmail.com` and
> authorize your zone. Everything stays under your control.

---

## 0. One-time: set your GitHub + pick a subdomain

- Open `webapp/static/index.html`, find `const GITHUB_USER = "YOUR_GITHUB";`
  near the bottom and put your GitHub username there.
- Decide the URL. Short suggestions on your domain `<YOURDOMAIN>`:
  `nt.<YOURDOMAIN>` · `trace.<YOURDOMAIN>` · `nulltrace.<YOURDOMAIN>`

---

## 1. Install dependencies & run the app locally

```powershell
cd C:\Users\fahad\OneDrive\Desktop\Temp\nulltrace
.\.venv\Scripts\python -m pip install -r requirements.txt
$env:PYTHONPATH = "."
.\.venv\Scripts\python -m uvicorn webapp.server:app --host 127.0.0.1 --port 8080
```

Open http://127.0.0.1:8080 — you should see NullTrace. Leave it running.
(There's a convenience script: `webapp\start.ps1`.)

---

## 2. Install cloudflared

```powershell
winget install --id Cloudflare.cloudflared
```
(or download from https://github.com/cloudflare/cloudflared/releases)

### Quick test (temporary URL, no account needed)
```powershell
cloudflared tunnel --url http://localhost:8080
```
This prints a random `https://xxxx.trycloudflare.com` link that works while the
command runs. Great for a first look; **not** permanent — use the named tunnel below.

---

## 3. Named tunnel (permanent, on your domain)

Your domain must already be a zone in this Cloudflare account.

```powershell
# 3a. Sign in (opens browser -> log in as fahadstudyy@gmail.com -> pick your domain)
cloudflared tunnel login

# 3b. Create the tunnel (writes a credentials .json under %USERPROFILE%\.cloudflared\)
cloudflared tunnel create nulltrace

# 3c. Point your chosen hostname at the tunnel (creates the DNS record for you)
cloudflared tunnel route dns nulltrace nt.<YOURDOMAIN>
```

Create `%USERPROFILE%\.cloudflared\config.yml` (copy from `webapp/config.example.yml`):

```yaml
tunnel: nulltrace
credentials-file: C:\Users\fahad\.cloudflared\<TUNNEL-UUID>.json
ingress:
  - hostname: nt.<YOURDOMAIN>
    service: http://localhost:8080
  - service: http_status:404
```
Replace `<TUNNEL-UUID>` with the id printed by `tunnel create` (it's also the json filename).

Run it:
```powershell
cloudflared tunnel run nulltrace
```
Visit `https://nt.<YOURDOMAIN>` — NullTrace is live.

---

## 4. Keep it running ("so it stays")

Install **both** pieces as background services so they survive reboots:

**Tunnel as a Windows service:**
```powershell
cloudflared service install
```

**App as a service** — easiest with [NSSM](https://nssm.cc/):
```powershell
nssm install NullTrace "C:\Users\fahad\OneDrive\Desktop\Temp\nulltrace\.venv\Scripts\python.exe" "-m uvicorn webapp.server:app --host 127.0.0.1 --port 8080"
nssm set NullTrace AppDirectory "C:\Users\fahad\OneDrive\Desktop\Temp\nulltrace"
nssm set NullTrace AppEnvironmentExtra "PYTHONPATH=."
nssm start NullTrace
```
(Or run `webapp\start.ps1` from Task Scheduler at logon.)

For a 24/7 public tool, running these on a small always-on VPS instead of your PC
is recommended — the same steps apply.

---

## 5. Recommended Cloudflare hardening (dashboard)

- **SSL/TLS:** Full (strict).
- **WAF / Rate limiting:** add a rate-limit rule on `nt.<YOURDOMAIN>/api/check`
  (e.g. 10 requests/min per IP) so the box can't be abused for mass enumeration.
- Optionally put **Cloudflare Access** in front of the whole hostname to require a
  login (your email) before anyone can reach it — turns it into a private tool.

The app also self-limits: `NULLTRACE_MAX_INFLIGHT` (default 3) caps concurrent
scans, and `NULLTRACE_TIMEOUT` (default 15s) bounds each check.

---

### Environment variables
| var | default | meaning |
|-----|---------|---------|
| `NULLTRACE_MAX_INFLIGHT` | 3 | max simultaneous scans across all visitors |
| `NULLTRACE_TIMEOUT` | 15 | per-site request timeout (seconds) |
