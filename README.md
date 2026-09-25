<h1 align="center">🔍 NullTrace</h1>

<p align="center"><strong>Find where an email address is registered. An educational OSINT email footprint scanner.</strong></p>

<p align="center">
  <a href="https://nulltrace.fahadiot.workers.dev"><strong>🚀 Launch NullTrace (Live Demo)</strong></a>
</p>

<p align="center">
  <a href="https://nulltrace.fahadiot.workers.dev">https://nulltrace.fahadiot.workers.dev</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/purpose-educational%20only-f4c430" alt="Educational only">
  <img src="https://img.shields.io/badge/runs%20on-Cloudflare%20Workers-f38020" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/checks-39%20sites-38bdf8" alt="39 sites">
  <img src="https://img.shields.io/badge/license-GPLv3-3178c6" alt="GPLv3">
</p>

## Overview

Enter an email address you own and NullTrace checks it, in parallel, against dozens of sites' public sign up and login lookups to reveal where that address is registered, streaming each result live. It never emails the address, creates accounts, or attempts logins.

> ⚠️ **For educational and authorized use only.** Only trace addresses you own or are explicitly authorized to test. You are responsible for complying with all applicable laws and each site's terms of service.

## Features

* Live streaming results. Each site's verdict appears the moment it lands, over Server Sent Events.
* 39 working checks. Only sites that reliably respond today (full list below).
* Zero footprint on the target. Read only "is this email registered" endpoints, with no emails, no logins, and no account creation.
* Runs entirely on Cloudflare's edge. One free Worker, no server to maintain, always available.
* Clean, responsive interface. Works from phone to large screen, with a live scan log, progress bar, and result cards.
* Also ships as a Python CLI and FastAPI app for local use.

## Live demo

Open **[https://nulltrace.fahadiot.workers.dev](https://nulltrace.fahadiot.workers.dev)**, confirm the authorization checkbox, enter an email, and press Trace.

## How it works

NullTrace ships in two forms that share the same detection logic.

* **Cloudflare Worker** (the deployed version) in `worker/`. A JavaScript port of all 39 checks plus the interface, served from the edge. This powers the live site.
* **Python engine and web app** in `nulltrace/` and `webapp/`. The original engine (based on the holehe technique) and a FastAPI plus SSE server for running locally.

The browser opens a scan, the Worker fans out to the public "email exists" endpoints, and results stream back as each site responds. Each check maps a site's response to one of three states: used (registered), free (not registered), or blocked (rate limited, bot challenged, or unexpected).

## Sites checked (39)

* **CMS**: gravatar, wordpress
* **CRM**: amocrm, hubspot, insightly
* **Forums**: biosmods, blitzortung, clashfarmer, nextpvr, thecardboard
* **Jobs**: freelancer, seoclerks
* **Learning**: diigo, duolingo, edx
* **Mail**: mail.ru
* **Media**: flickr, komoot, rambler
* **Music**: deezer, spotify
* **Productivity**: any.do
* **Events**: eventbrite
* **Programming**: codecademy, devrant, teamtreehouse
* **Shopping**: naturabuy
* **Social**: myspace, odnoklassniki, plurk, twitter
* **Software**: adobe, firefox, issuu, lastpass, office365
* **Sport**: chess.com
* **Adult**: xnxx, xvideos

Many major platforms (Facebook, Instagram, GitHub, Google, Discord, Amazon, and others) intentionally sit behind bot protection or only respond to real sign up attempts, so they cannot be checked without bypassing that protection. NullTrace deliberately does not do that, so they are excluded rather than faked.

## Run locally

### Option A, the Cloudflare Worker (Node)

```
cd worker
npm install
npx wrangler dev
```

Then open the printed local address.

### Option B, the Python app

```
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
$env:PYTHONPATH = "."
.venv\Scripts\python -m uvicorn webapp.server:app --port 8080
```

Then open the local address on port 8080.

### Legacy CLI

```
.venv\Scripts\nulltrace.exe you@example.com --only-used
```

## Deploy your own (Cloudflare Worker, free)

1. Create a Cloudflare API token with the Edit Cloudflare Workers permissions.
2. Deploy:

```
cd worker
CLOUDFLARE_API_TOKEN=yourtoken npx wrangler deploy
```

3. Wrangler prints your live URL at `https://<worker>.<yoursubdomain>.workers.dev`.

Change the name any time by editing `name` in `worker/wrangler.toml` and redeploying.

## Configuration

* Worker (`worker/src/worker.js`): `CONCURRENCY` for parallel checks and `PER_CHECK_TIMEOUT_MS` for the per site timeout.
* Python app environment variables: `NULLTRACE_MAX_INFLIGHT` (default 3) and `NULLTRACE_TIMEOUT` (default 15 seconds).

## Limitations

* Running from Cloudflare's edge, some sites block datacenter addresses more aggressively than a home connection, so the Worker may find fewer accounts than the local Python version.
* Detection reflects each site's current public behavior. Sites change, so checks can drift over time.

## Legal and ethics

NullTrace is provided for education and authorized security testing only. Do not use it to harass, stalk, or profile people. Only check addresses you own or are explicitly authorized to assess. You are solely responsible for how you use it.

## Credits

* Detection technique and original site modules: holehe by megadose at https://github.com/megadose/holehe (GPLv3).
* NullTrace web app, Worker port, and interface by fahadiot at https://github.com/fahadiot.

## License

GPLv3. See [LICENSE.md](LICENSE.md).
