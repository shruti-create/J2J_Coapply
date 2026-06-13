# 🌿 bloom tracker

A community job-application tracker. Each person tracks their own applications; everyone
shares one community garden with pooled stats and a live activity feed.

- **Frontend:** static `index.html` (vanilla JS, Chart.js) — Firebase Web SDK for auth & live reads.
- **Backend:** TypeScript **Netlify Functions** (`netlify/functions/`) using `firebase-admin`.
- **Data/Auth:** Firebase **Firestore** + **Email/Password Authentication**.
- **Hosting:** Netlify (frontend + functions deploy together).

## Architecture

```
Browser ──(Firebase Auth, email/password)──► Firebase Auth
   │  reads (live):  onSnapshot ─────────────► Firestore  (read-only rules)
   │  writes:        fetch w/ ID token ──► Netlify Functions (TS) ──► Firestore (admin)
```

All **writes** go through the TypeScript backend (token-verified, ownership-checked, also
emits feed events). All **reads** stream directly from Firestore so the shared pool, community
stats, and live feed update in real time. Firestore rules deny client writes entirely.

> ⚠️ **Privacy:** this is a *full shared pool* — every signed-in user can read everyone's
> application records (including notes/salary/recruiter). To restrict this later, change
> `firestore.rules` and have the backend serve only the current user's records.

## One-time setup

### 1. Firebase project
1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database** (production mode).
4. **Authentication → Settings → Authorized domains** — add `localhost` and your Netlify
   domain (e.g. `your-site.netlify.app`).
5. Deploy the rules in `firestore.rules` (Console → Firestore → Rules, or
   `firebase deploy --only firestore:rules`).

### 2. Environment variables
Nothing Firebase-related is hard-coded in `index.html`. Both the public web config and the
secret admin credentials come from env vars — set them as **Netlify environment variables**
(Site → Settings → Environment variables), and for local dev put them in a git-ignored `.env`
(see `.env.example`).

**Public web config** (Console → Project settings → General → Your apps → Web → SDK config).
The frontend fetches these at runtime from `/.netlify/functions/config`:
- `FIREBASE_API_KEY` (required)
- `FIREBASE_APP_ID`
- `FIREBASE_AUTH_DOMAIN` / `FIREBASE_STORAGE_BUCKET` / `FIREBASE_MESSAGING_SENDER_ID` (optional —
  `AUTH_DOMAIN`/`STORAGE_BUCKET` default to `<projectId>.firebaseapp.com` / `.appspot.com`)

**Secret admin credentials** (Console → Project settings → Service accounts → Generate new
private key → open the JSON):
- `FIREBASE_PROJECT_ID`  (shared by both the web config and the admin SDK)
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`  (keep the literal `\n` escapes, wrapped in quotes)

## Run locally

```bash
npm install
npm i -g netlify-cli      # one-time (not a project dep — incompatible with Node 25 postinstall)
netlify dev               # serves index.html + functions at http://localhost:8888
```

Make sure `localhost` is in Firebase Authorized domains. Type-check the backend with
`npm run typecheck`.

## Deploy

Connect the repo to Netlify (it reads `netlify.toml`), set the three env vars, and add the
production domain to Firebase Authorized domains. Or: `netlify deploy --prod`.

## Endpoints (TypeScript Netlify Functions)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/.netlify/functions/config` | Public Firebase web config (from env) — no auth |
| `POST` | `/.netlify/functions/applications` | Create an application (+ feed event) |
| `PUT` | `/.netlify/functions/applications` | Update own application (status change → feed event) |
| `DELETE` | `/.netlify/functions/applications` | Delete own application |
| `GET` | `/.netlify/functions/stats` | Community aggregates (totals, rates, top companies, monthly volume) |

All require an `Authorization: Bearer <Firebase ID token>` header.

## Data model (Firestore)

- `applications/{id}` — `company, role, status, priority, location, date, salary, url,
  recruiter, followup, notes, starred, ownerUid, ownerName, createdAt, updatedAt`
- `feed/{id}` — `type ('applied'|'status'|'offer'), company, role, status, ownerName, ts`
