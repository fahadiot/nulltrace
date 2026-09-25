# Launch the NullTrace web service.
# Usage:  .\webapp\start.ps1   (run from the repo root)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:PYTHONPATH = "."
& "$root\.venv\Scripts\python.exe" -m uvicorn webapp.server:app --host 127.0.0.1 --port 8080
