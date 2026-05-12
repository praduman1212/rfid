# C72 RFID live scan dashboard

Next.js app that receives EPC codes from a **Chainway C72** (or any HTTP client), stores them in **Firebase Firestore**, and shows a **polling dashboard** on the home page.

## Features

- **POST `/api/scan`** — primary endpoint for the reader. JSON body: `{ "epc": "..." }`.
- **POST `/api/scans`** — same behavior as `/api/scan` (handy for the test `curl` below).
- Normalizes EPCs: trims whitespace, uppercases, rejects empty values.
- Upserts one Firestore document per EPC: increments `scanCount`, updates `lastSeenAt`.
- **GET `/api/scans`** — returns all stored EPCs (newest first), plus aggregate fields for the UI.
- **Home page (`/`)** — live dashboard: unique EPC count, latest scan time, table (No., EPC, scan count, last seen), auto-refresh every 4 seconds.

Firestore collection: **`rfid_scans`**. Document ID = normalized EPC string.

## Prerequisites

- Node.js 20+ recommended (matches Next.js 16).
- A Firebase project with **Firestore** enabled.
- A **service account** JSON key with permission to read/write Firestore (used only on the server).

## Install

```bash
npm install
```

## Environment variables

Create or edit **`.env.local`** at the project root (Next.js loads it automatically; it is gitignored). Add every variable you need:

| Variable | Where it is used |
|----------|------------------|
| `NEXT_PUBLIC_FIREBASE_*` | Client Firebase config (already used by `firebase.tsx`). |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Server**: full service account JSON as a **single line** string (required for API routes to talk to Firestore). |

### Service account JSON in `.env.local`

1. In [Firebase Console](https://console.firebase.google.com/) → Project settings → Service accounts → Generate new private key.
2. Open the downloaded `.json` file, minify to one line, and set:

```env
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...", ... }
```

**Do not commit** this line or the JSON file to git.

### Alternative: Application Default Credentials

If you use `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS` to a key file path, you can omit `FIREBASE_SERVICE_ACCOUNT_JSON`. You may still set `NEXT_PUBLIC_FIREBASE_PROJECT_ID` / `FIREBASE_ADMIN_PROJECT_ID` so the Admin SDK knows the project.

## Firestore rules

The Admin SDK **bypasses** security rules. For production, keep using the API from devices; do not expose the service account on clients.

If you later add direct browser access to Firestore, tighten rules accordingly.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the dashboard.

Production:

```bash
npm run build
npm start
```

## API reference

### POST `/api/scan` or POST `/api/scans`

**Body (reader):**

```json
{ "epc": "E28069995000050008D040989" }
```

For quick tests, **`ep` is also accepted** (common typo in sample curls): `{ "ep": "E28069995000050008D040989" }`.

**Success (200):**

```json
{ "success": true, "epc": "E28069995000050008D040989" }
```

**Validation failure (400):**

```json
{ "success": false, "epc": "" }
```

(or `epc` set to the invalid value when applicable)

CORS: `Access-Control-Allow-Origin: *` on these routes so a reader can POST from another host if needed.

### GET `/api/scans`

**Example response:**

```json
{
  "scans": [
    {
      "epc": "E28069995000050008D040989",
      "scanCount": 2,
      "lastSeenAt": "2026-05-11T14:05:00.000Z"
    }
  ],
  "totalUniqueEpcs": 1,
  "totalReads": 2,
  "latestScanAt": "2026-05-11T14:05:00.000Z"
}
```

## Test without the physical reader

### Windows (PowerShell)

PowerShell is **not** bash. Inside **double** quotes, `\"` does **not** reliably produce a JSON string for `curl.exe`, so the server often gets broken JSON and responds with `{"success":false,"epc":""}`. Use **single quotes** around the whole JSON for `-d` (then the inner `"` characters are fine).

**Recommended: one line** (avoids backtick line-continuation bugs and the `curl: (3) URL rejected: Port number...` error):

```powershell
curl.exe -X POST "http://localhost:3000/api/scans" -H "content-type: application/json" -d '{"ep":"E28069995000050008D040989"}'
```

Reader-shaped body (`epc` + `/api/scan`):

```powershell
curl.exe -X POST "http://localhost:3000/api/scan" -H "content-type: application/json" -d '{"epc":"E28069995000050008D040989"}'
```

**Multi-line (only if you need it):** put the JSON in single quotes on the `-d` line—no `\"` escaping.

```powershell
curl.exe -X POST "http://localhost:3000/api/scans" `
  -H "content-type: application/json" `
  -d '{"ep":"E28069995000050008D040989"}'
```

**Native PowerShell** (no `curl.exe`):

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/scans" `
  -ContentType "application/json" `
  -Body '{"ep":"E28069995000050008D040989"}'
```

### See the HTTP status, headers, and body (errors included)

By default, `curl.exe` only prints the **response body**. To debug, add **`-i`** (`--include`) so you also see the **status line** (for example `HTTP/1.1 400 Bad Request`) and **response headers** before the body. That is how you confirm whether the failure is **400** (bad JSON / missing EPC), **500** (server/Firestore), or **200** (OK).

**PowerShell — POST (test scan), show status + headers + body:**

```powershell
curl.exe -i -X POST "http://localhost:3000/api/scans" -H "content-type: application/json" -d '{"ep":"E28069995000050008D040989"}'
```

**PowerShell — POST with `epc` to `/api/scan`:**

```powershell
curl.exe -i -X POST "http://localhost:3000/api/scan" -H "content-type: application/json" -d '{"epc":"E28069995000050008D040989"}'
```

**PowerShell — GET all scans (same idea):**

```powershell
curl.exe -i "http://localhost:3000/api/scans"
```

**Extra detail (DNS, TCP, TLS, request headers)** — use **`-v`** (verbose). Combine with **`-i`** if you want response headers too:

```powershell
curl.exe -v -i -X POST "http://localhost:3000/api/scans" -H "content-type: application/json" -d '{"ep":"E28069995000050008D040989"}'
```

**Print only the numeric HTTP code** after the body (handy in scripts):

```powershell
curl.exe -s -o - -w "`nHTTP_STATUS:%{http_code}`n" -X POST "http://localhost:3000/api/scans" -H "content-type: application/json" -d '{"ep":"E28069995000050008D040989"}'
```

(`-s` = silent progress; `-o -` = write response body to stdout; `` `n `` = newline in PowerShell.)

**Where else to look:** if the status is **500**, open the terminal where **`npm run dev`** is running — failed API routes log a short message there (`console.error`) while the JSON body stays `{ "success": false, "epc": "..." }`.

### macOS / Linux

```bash
curl -X POST http://localhost:3000/api/scans \
  -H "content-type: application/json" \
  -d '{"ep":"E28069995000050008D040989"}'
```

Then refresh the dashboard (or wait for the next poll); the EPC should appear with an increasing **scan count** on each POST.

### Fetch all scans

```bash
curl http://localhost:3000/api/scans
```

**Include status and headers (macOS / Linux):**

```bash
curl -i http://localhost:3000/api/scans
```

## Pointing the Chainway C72 at this app

Configure the reader’s HTTP POST URL to your deployed origin (or LAN IP) plus **`/api/scan`**, content type **application/json**, body **`{"epc":"<scanned_epc>"}`**. Ensure the device can reach the host (same Wi‑Fi / VPN / firewall rules).

## Project layout (relevant parts)

- `app/api/scan/route.ts` — POST scan (reader).
- `app/api/scans/route.ts` — GET list + POST scan (testing / alternate path).
- `lib/scans.ts` — Firestore upsert and list logic.
- `lib/firebase-admin.ts` — Firebase Admin initialization.
- `app/live-scan-dashboard.tsx` — client dashboard with polling.
- `firebase.tsx` — client Firebase app (unchanged pattern for other features).

## Troubleshooting

- **500 on POST/GET** — usually missing or invalid Admin credentials. Set `FIREBASE_SERVICE_ACCOUNT_JSON` or Application Default Credentials and restart `npm run dev`.
- **Empty dashboard after successful curl** — confirm Firestore project ID in the service account matches the project where you expect data; check collection `rfid_scans` in the console.
- **`{"success":false,"epc":""}` in PowerShell** — almost always a bad request body. Do not use `\"...\"` inside double quotes for `-d`. Use `-d '{"ep":"..."}'` or `Invoke-RestMethod` as in the Windows examples above.
- **`curl: (3) URL rejected: Port number was not a decimal number...`** — usually a mangled command (line breaks / stray characters / smart quotes). Prefer the **single-line** `curl.exe` example; quote the URL (`"http://localhost:3000/..."`).
- **Seeing the real HTTP error** — use **`curl.exe -i`** as in the section **See the HTTP status, headers, and body (errors included)** above. **400** + `{"success":false,"epc":""}` usually means the JSON body did not reach the server correctly (PowerShell quoting). **500** means a server/Firestore problem; check the **`npm run dev`** terminal output.
