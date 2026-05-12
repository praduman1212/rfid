# RFID dashboard — student guide

This note walks you through **how this small project works**, question by question. Read it like a lab handout: you are learning what each piece does and **where to look in the code** when something confuses you.

Think of the system as three actors:

1. **The C72 reader** — hardware that sees a tag and sends JSON over HTTP.
2. **The Next.js server** — your app receives that JSON, talks to the database, and answers with JSON.
3. **The browser dashboard** — a webpage that **asks the server repeatedly** “what is the latest list of scans?” and redraws the table.

---

## 1. Which file receives the scan request?

When someone (the C72 or `curl`) sends an HTTP **POST** with a JSON body, Next.js routes that URL to a **route handler** file named `route.ts` inside the `app/api/...` folder.

You have **two** entry points that can accept a scan. Both end up calling the same helper logic:

| URL you POST to | File that “receives” the HTTP request |
|-----------------|----------------------------------------|
| `/api/scan`     | `app/api/scan/route.ts`                |
| `/api/scans`    | `app/api/scans/route.ts` (POST branch) |

So: the **first** place the HTTP request “lands” is one of those `route.ts` files. Their job is small: read the body, call shared code in `lib/scans.ts`, return JSON.

**Teaching point:** In the App Router, the path in the folder tree **is** the URL. `app/api/scan/route.ts` → `/api/scan`.

---

## 2. Where do you save the EPC in the database?

The database here is **Firebase Firestore** (a NoSQL document database in the cloud).

The actual **write** happens in **`lib/scans.ts`**, inside the function `recordScan`.

- **Collection name:** `rfid_scans` (see the constant `SCANS_COLLECTION` at the top of that file).
- **Document ID:** the **normalized EPC** string (trimmed, uppercased). One document per unique EPC.
- **Fields stored on each document:** at least `epc`, `scanCount`, `lastSeenAt`, and `updatedAt`.

The server uses the **Firebase Admin SDK** (`lib/firebase-admin.ts`) so writes happen **on the server** with a service account — not from the browser with your public API keys.

**Teaching point:** “Where is it saved?” = **Firestore → collection `rfid_scans` → document id = that EPC**. The code path is `recordScan` in `lib/scans.ts`.

---

## 3. What happens if the same EPC is scanned twice?

Nothing “breaks.” The system is designed to **count repeats**.

Inside `recordScan`, a **Firestore transaction** reads the existing document (if any), then:

- If it is the **first** time you see that EPC: `scanCount` becomes **1**.
- If that EPC **already exists**: `scanCount` is **incremented** by one, and `lastSeenAt` is updated to **now**.

So the same tag scanned twice becomes **one row** in your mental model (one document), with **scan count = 2** and a newer **last seen** time.

**Teaching point:** You are not inserting duplicate rows for the same EPC; you are **updating** one document to reflect “how many times we have seen this tag.”

---

## 4. How does the dashboard update automatically?

Open **`app/live-scan-dashboard.tsx`**. Near the top you will see:

```ts
const POLL_MS = 4000;
```

The dashboard uses **polling**, not magic:

1. When the component mounts, `useEffect` runs once.
2. It calls `refresh()`, which does `fetch("/api/scans", { cache: "no-store" })` and stores the JSON in React state.
3. It starts `setInterval(..., POLL_MS)` so **every 4 seconds** it calls `refresh()` again.
4. When new data arrives, React re-renders — the numbers and table update.

So “automatic” here means: **the browser keeps asking the server on a timer**. It is simple, easy to reason about, and good enough for a class project or a low-traffic floor display.

**Teaching point:** This is **not** WebSockets and **not** Firestore listeners in the browser. It is **periodic HTTP GET** to your own API.

---

## 5. What URL should be entered into the C72 app?

The reader should send a **POST** request to your server’s **public base URL** plus this path:

```text
https://YOUR_DOMAIN_OR_IP/api/scan
```

Examples (replace with your real host):

- Local network PC: `http://192.168.1.50:3000/api/scan` (only while `npm run dev` or `npm start` runs on that machine).
- Deployed website: `https://your-app.vercel.app/api/scan`

**Body** the C72 should send (JSON), as you already designed:

```json
{ "epc": "E28069995000050008D040989" }
```

**Headers:** `Content-Type: application/json`.

This project also accepts **`POST /api/scans`** with the same JSON (useful for testing from a laptop). For the **real device**, prefer **`/api/scan`** so the URL matches your original spec.

**Teaching point:** The C72 does not “open a webpage.” It sends **HTTP** to an **API path**. The phone/laptop browser is separate; it loads `/` and polls `GET /api/scans`.

---

## 6. How would you debug it if the C72 cannot send data?

Work **from the network inward**. Do not guess; narrow the problem.

**Step A — Is the server reachable at all?**  
From another device on the same Wi‑Fi, open the dashboard URL in a browser, or run:

```powershell
curl.exe -i "http://YOUR_IP:3000/api/scans"
```

If that fails, fix **firewall**, **wrong IP**, **server not running**, or **wrong port** first.

**Step B — Can you POST like the C72 would?**  
Use `curl.exe -i` so you see **status code + headers + body** (see the main `README.md`). If you get **400** with `{"success":false,"epc":""}`, the JSON body is wrong or empty (quoting mistakes in PowerShell are a classic cause).

**Step C — If the POST returns 500**  
The reader is probably reaching you, but **Firestore or credentials** failed. Read the terminal where **`npm run dev`** is running — errors are logged there. Almost always: **`FIREBASE_SERVICE_ACCOUNT_JSON`** missing, malformed, or wrong project.

**Step D — C72-specific checks**  
Same subnet? Correct URL including `http` vs `https`? Some networks block device-to-PC traffic. If you use HTTPS in production, the device must trust the certificate (a cheap LAN server with self-signed HTTPS is painful — use HTTP on LAN for experiments, or a real hostname with a valid cert).

**Teaching point:** Split the world into **(1) network path**, **(2) HTTP shape**, **(3) server logs**, **(4) database credentials**.

---

## 7. Why did you choose this database?

In **your** project, Firebase was already part of the goal: you asked for Firestore, and the repo already had client Firebase config. That is a perfectly valid reason in real life too: **fit the stack the team already runs**.

Conceptually, Firestore is a good match for this shape of data:

- **Many small writes** (each scan) and **simple reads** (“give me all tag summaries”).
- **Server-side Admin SDK** keeps secrets off the device.
- **Hosted** — you do not maintain PostgreSQL disks yourself for a classroom demo.

Tradeoffs you should know as a student: for heavy analytics or strict relational constraints, people often reach for **SQL**. Here we only need “one row per EPC with a counter,” so documents are fine.

---

## 8. What would you improve if this becomes a real production system?

Think in layers: **security**, **reliability**, **observability**, **product**.

**Security**

- **Authenticate** the C72 (API key, HMAC, mTLS, or a device token) so random clients cannot POST garbage.
- **Rate limiting** and payload size limits.
- Tighten **CORS** instead of `*` if you do not need arbitrary browsers posting.

**Reliability and data**

- **Indexes** and query patterns if the table grows huge (right now we read the whole collection for the dashboard — fine for hundreds, bad for millions without pagination).
- **Idempotency keys** if the reader might retry the same physical scan and you need exact-once semantics beyond “increment count.”

**Observability**

- Structured **logging**, **metrics**, and **alerts** when error rate spikes or Firestore quota is hit.

**Product / UX**

- **WebSockets or Server-Sent Events** instead of 4-second polling if you need near-instant UI.
- **Pagination**, **search**, **export CSV**, **operator notes** on a tag — whatever the warehouse actually needs.

**Teaching point:** The current app is a **thin vertical slice**: receive → store → show. Production is the same idea with **guards, limits, and visibility** wrapped around it.

---

## Quick map (files to open)

| Question              | Start here                          |
|-----------------------|-------------------------------------|
| Receives POST         | `app/api/scan/route.ts`, `app/api/scans/route.ts` |
| Saves EPC             | `lib/scans.ts` → `recordScan`       |
| Dashboard auto-refresh| `app/live-scan-dashboard.tsx`       |
| Lists scans for UI    | `app/api/scans/route.ts` (GET)      |

When in doubt, search the repo for **`recordScan`** or **`/api/scans`** — those strings connect the story end to end.
