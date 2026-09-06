# E-Vigilance

A traffic-violation reporting system for citizens, built as an installable **PWA** with a
**Node.js/Express + MongoDB** backend. It replaces the previous Flutter mobile app and shares
the same MongoDB Atlas database as the existing admin dashboard, so every report filed here
appears in the admin panel immediately.

```
E-Vigilance/
├── server/          Express REST API  (Node 18+)
│   ├── server.js
│   └── src/{config,models,services,controllers,middlewares,routes,utils}
└── web/             React PWA         (Vite 6 + React 18)
    ├── public/      icons + manifest assets
    └── src/{api,components,context,hooks,pages,styles}
```

---

## 1. Quick start

```bash
# from the project root
npm run install:all          # installs both server/ and web/

# terminal 1 - API on http://localhost:5050
npm run dev:api

# terminal 2 - PWA on http://localhost:5173
npm run dev:web
```

Open **http://localhost:5173**, create an account, and file a report.

> **Port note:** the API runs on **5050**, not 5000. On macOS, port 5000 is taken by the
> AirPlay Receiver (Control Center). Change `PORT` in `server/.env` if you prefer another.

### Production (single origin, no CORS)

```bash
npm run build     # builds web/dist
npm start         # Express serves the API *and* the built PWA on http://localhost:5050
```

When `web/dist` exists the server serves the PWA at `/` and the API under `/api`.
Without a build, `/` returns the API description instead.

---

## 2. Configuration

Everything lives in `server/.env` (copy from `server/.env.example`).

| Variable | Purpose |
|---|---|
| `PORT` | API port (default `5050`) |
| `MONGO_URI` | MongoDB Atlas connection string — **the same cluster the admin panel uses** |
| `JWT_SECRET` | Long random string used to sign tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API |
| `STORAGE_DRIVER` | `auto` (default), `gridfs`, or `cloudinary` |
| `MAX_UPLOAD_MB` | Per-file upload limit (default `50`) |
| `CLOUDINARY_*` | Optional — fill in to move media to Cloudinary |
| `PUBLIC_BASE_URL` | Optional — absolute origin used when building GridFS media URLs |

The frontend needs no configuration for local work (Vite proxies `/api` to the server).
If you host the PWA separately from the API, set `VITE_API_URL` in `web/.env`.

### Media storage

Media works out of the box with **no extra accounts**: files are stored in **MongoDB GridFS**
and streamed back from `GET /api/media/:id` (with HTTP Range support, so video and audio
can be seeked).

Your existing reports use Cloudinary (cloud `ds5ugvgez`). To send new uploads there instead,
add the three keys to `server/.env` and restart:

```env
CLOUDINARY_CLOUD_NAME=ds5ugvgez
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

`STORAGE_DRIVER=auto` switches to Cloudinary automatically once the keys are present. Nothing
else changes — the API and the database records look identical either way.

---

## 3. Testing camera, microphone and GPS on a real phone

Browsers only grant camera/mic/GPS on a **secure context**: `localhost`, or any HTTPS origin.
Opening `http://192.168.x.x:5173` on your phone will load the app but those features will
refuse, and the app will say so rather than failing silently.

```bash
npm run dev:web:https        # serves https://<your-lan-ip>:5173 with a self-signed cert
```

Open that address on the phone and accept the certificate warning once. Camera, microphone and
GPS all work after that (verified: `isSecureContext` is true and `getUserMedia` resolves).

Every capture screen also offers a plain **Upload** path, which works on any origin.

> **Self-signed HTTPS is enough for camera/mic/GPS, but *not* for installing the app.**
> Chrome refuses to install from an origin with a certificate error, reporting
> `not-from-secure-origin`. To test a real install on a phone, use one of:
>
> - **Chrome port forwarding** (best for local work): `chrome://inspect/#devices` on the
>   desktop → *Port forwarding* → map `5173` → `localhost:5173`. The phone then loads
>   `http://localhost:5173`, which counts as a trusted secure origin, and installs properly.
> - **A tunnel with a real certificate**: `cloudflared tunnel --url http://localhost:5173`,
>   or `ngrok http 5173`.
> - **A real deployment** behind proper TLS.

---

## 4. What the app does

**Auth** — email + password, NIC and optional phone. Passwords are bcrypt-hashed; sessions are
JWTs kept in `localStorage`. Many users can be signed in on different devices at once, and each
only ever sees their own reports.

**Dashboard** — greeting, per-status counters (total / in progress / completed / rejected),
recent reports, and an install prompt.

**Report wizard** — seven steps, with per-step validation and a draft saved as you type:

1. **Evidence** — take a photo or record video in-app (`getUserMedia` + `MediaRecorder`),
   or upload existing files. Up to 10 files, 50 MB each.
2. **Vehicle** — type, number plate (auto-uppercased), make/model.
3. **Date & time** — with quick picks; future times are rejected.
4. **Issue type** — 14 preset violations plus a free-text "Other".
5. **Location** — one tap captures GPS, reverse-geocodes to an address and shows a map;
   the address can always be typed by hand.
6. **Details** — free text plus an optional **voice note** with a live level meter.
7. **Review** — a summary with per-section Edit links, then submit with an upload progress bar.

**My reports** — searchable, filterable by status, with media thumbnails.

**Report detail** — media gallery (photos + video), voice-note player, full details, a map of
the location, and a status timeline.

**Profile** — edit name/phone, switch light/dark theme, install the app, sign out.

**PWA** — installable, works offline for previously loaded screens (app shell precached,
API reads cached network-first, media cached first), with an offline banner.

**Install prompt** — a bottom sheet appears a couple of seconds after load:

- **Chrome / Edge / Android** — an **Install app** button wired to `beforeinstallprompt`. This
  performs a *real* install (a WebAPK on Android): the app lands in the **app drawer / app
  list**, gets its own entry in Settings → Apps and its own task in the recents switcher, and
  opens in a standalone window with no browser UI. It is not a bookmark shortcut.
- **iOS Safari** — Apple has no WebAPK equivalent and no programmatic install, so the sheet
  shows the three manual steps (Share → Add to Home Screen → Add). On iOS it genuinely is a
  home-screen item; the copy says so rather than over-promising.
- **Not now** is remembered for 7 days. The sheet never appears once installed, while running
  standalone, or during the report wizard (it must not interrupt evidence capture), and it
  layers *below* dialogs so it can never cover the camera sheet.
- Profile → *Install app* is always available as a second entry point.

### Requirements for a real app install

Chrome only offers a true install when **all** of these hold — otherwise it degrades to a plain
"Add to Home screen" bookmark:

| Requirement | Where it comes from |
|---|---|
| Secure origin with a **trusted** certificate, or `localhost` | a real deployment, a tunnel, or Chrome port forwarding — **a self-signed cert does not qualify** |
| Web app manifest served | `vite-plugin-pwa` — **enabled in dev as well as prod** |
| `display: standalone` + `display_override` | `vite.config.js` manifest |
| Stable `id`, `start_url`, `scope` | `vite.config.js` manifest |
| 192px + 512px icons, plus a maskable icon | `web/public/icon-*.png` |
| Service worker with a fetch handler | generated `sw.js` |
| `screenshots` (narrow + wide) | `web/public/screenshots/` — these upgrade Chrome's minimal install bar into the full **Install app** dialog |

> **The usual reason it "only adds to the home screen" is the origin.** Over plain
> `http://192.168.x.x:5173` — and also over the self-signed `https://192.168.x.x:5173` —
> Chrome reports `not-from-secure-origin` and offers a bookmark instead of installing.
> Use Chrome port forwarding, a tunnel, or a real deployment (see §3).

Check any URL from the command line:

```bash
cd web && npm i -D puppeteer      # one-off
npm run check:install                          # http://localhost:5173
npm run check:install https://your-host.example # any origin
```

It prints each manifest requirement and Chrome's own verdict, so you can tell at a glance
whether a given URL will install as an app or only as a bookmark.

Verify at any time with Chrome DevTools → **Application → Manifest** ("Installability: no
issues"), or run `node installability.mjs` style checks against `Page.getInstallabilityErrors`.

If you change the screenshots, regenerate them at exactly **1080×1920** (narrow) and
**1920×1080** (wide) — Chrome ignores screenshots whose real pixels disagree with the declared
`sizes`.

---

## 5. API reference

All authenticated routes need `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Body | Purpose |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | – | JSON: `name, email, nic, phone?, password` | Create account → `{ token, user }` |
| `POST` | `/api/auth/login` | – | JSON: `email, password` | Sign in → `{ token, user }` |
| `GET` | `/api/auth/me` | ✓ | – | Current user (restores a session) |
| `PATCH` | `/api/auth/me` | ✓ | JSON: `name?, phone?` | Update profile |
| `POST` | `/api/reports` | ✓ | `multipart/form-data` | Create a report |
| `GET` | `/api/reports` | ✓ | `?status=&search=&page=&limit=` | The user's reports |
| `GET` | `/api/reports/stats` | ✓ | – | `{ total, completed, inProgress, rejected }` |
| `GET` | `/api/reports/:id` | ✓ | – | One report (403 if not yours) |
| `GET` | `/api/media/:id` | – | – | Stream GridFS media (supports `Range`) |
| `GET` | `/api/health` | – | – | Liveness probe |

**`POST /api/reports` fields** — files under `evidence` (repeatable, ≤10) and `voiceNote` (≤1);
text fields `vehicleType*`, `vehicleNumber*`, `vehicleModel`, `dateTime*` (ISO), `issueType*`,
`location`, `latitude`, `longitude`, `additionalDetails`. `*` = required.

---

## 6. Data model

Both collections are shared with the admin dashboard.

**`users`** — `name`, `email` (unique), `nic` (unique), `phone`, `password` (bcrypt),
`role: 'user'`, timestamps.

> The admin panel keeps its own staff accounts in this same collection using `password_hash`
> and roles like `hq`. The citizen login refuses those accounts with a clear message and
> directs them to the admin dashboard.
>
> `nic` carries a **unique, non-sparse** index, so NIC is mandatory at signup — otherwise a
> second account without one would collide with the existing admin record.

**`reports`** — every field the admin panel already reads is unchanged:

```
userId, evidencePath, vehicleType, vehicleNumber, vehicleModel,
dateTime, issueType, location, latitude, longitude,
additionalDetails, status ['In Progress'|'Completed'|'Rejected'], timestamps
```

plus two additive fields used by the PWA:

```
evidence: [{ url, kind: image|video|audio, mimeType, size, storage, publicId, originalName }]
voiceNote: { …same shape… }
```

`evidencePath` is still set to the first photo's URL, so **existing admin screens keep working
untouched** while the PWA can show every attachment.

---

## 7. Hosting

### What GitHub Pages can and cannot do

GitHub Pages serves **static files only**. It cannot run Express, connect to MongoDB, sign
JWTs, or accept uploads — so it can host `web/` (the PWA) but **not** `server/` (the API).

Two ways to deploy:

| Option | Where things run | When to pick it |
|---|---|---|
| **A. Single host** (simplest) | The Docker image serves API **and** PWA on one origin | Fewest moving parts, no CORS, media URLs just work |
| **B. Pages + API host** | PWA on GitHub Pages, API on Render/Railway/Fly/VPS | Free static hosting on a `github.io` URL |

Option A is one command — see §1 and the `Dockerfile`. Option B is set up below.

### Option B — PWA on GitHub Pages

The workflow at `.github/workflows/deploy-pages.yml` builds and deploys `web/` on every push to
`main`. Four things to do once:

**1. Deploy the API somewhere that runs Node.** Any host that takes a Dockerfile works:

```bash
docker build -t e-vigilance .
docker run --env-file server/.env -p 5050:5050 e-vigilance
```

Set these in that host's environment:

```env
MONGO_URI=...                                     # the shared Atlas cluster
JWT_SECRET=...                                    # a long random string
NODE_ENV=production
CORS_ORIGINS=https://<user>.github.io             # the Pages origin, no trailing slash
PUBLIC_BASE_URL=https://<your-api-host>           # so GridFS media URLs are absolute and public
```

`CORS_ORIGINS` and `PUBLIC_BASE_URL` are the two people forget. Without the first the browser
blocks every API call; without the second, evidence URLs point at `localhost` and never load.

**2. Point the PWA at that API.** In the repo:
*Settings → Secrets and variables → Actions → Variables → New variable*

```
Name:  VITE_API_URL
Value: https://<your-api-host>
```

The workflow fails early with a clear message if this is missing, rather than shipping a
frontend with no backend.

**3. Turn Pages on.** *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
(Not "Deploy from a branch" — the workflow publishes an artifact.)

**4. Push.** The site lands at `https://<user>.github.io/<repo>/`.

### Why the sub-path needs care

A project site is served from `/<repo>/`, not `/`. The build handles this via `BASE_PATH`:

- `vite.config.js` sets `base`, and rewrites the manifest's `start_url`, `scope`, `id`, icons,
  screenshots and shortcuts to include the prefix.
- `main.jsx` passes `import.meta.env.BASE_URL` to the router as `basename`.
- `scripts/spa-fallback.mjs` copies `index.html` to `404.html` after every build. Pages has no
  server-side rewrite, so a deep link like `/reports/123` would otherwise 404; Pages serves
  `404.html` for unmatched paths, which boots the app and lets the router resolve the URL.

Build it locally exactly as CI does:

```bash
cd web
VITE_API_URL=https://your-api npm run build:pages   # BASE_PATH=/E-Vigilance-Client/
```

### One real benefit of Pages

Pages serves over **trusted HTTPS**, which is exactly what the real app install needs (§4).
On `github.io` the *Install app* prompt performs a genuine WebAPK install — something neither
plain HTTP nor a self-signed certificate can do locally.

---

## 8. Mobile layout

The app is mobile-first and verified at **320 / 360 / 375 / 390 / 414 px** wide, across every
screen including all seven wizard steps and the camera sheet.

One rule keeps it that way: **grid and flex children default to `min-width: auto`**, which
refuses to shrink below their content. A single long unbroken line — a full reverse-geocoded
street address, say — will then stretch its whole column past the edge of the screen. Every
grid track and flex utility therefore sets `min-width: 0` (see `styles/layout.css` and the
`.stack` / `.row` utilities in `styles/theme.css`), and long values wrap with
`overflow-wrap: anywhere`.

`body { overflow-x: hidden }` is a safety net only — it hides such bugs rather than fixing
them, so when checking layout, disable it first.

---

## 9. Security notes

- Passwords bcrypt-hashed (cost 10); hashes never leave the server.
- JWT required on every report route; `GET/POST /api/reports*` are scoped to `req.userId`,
  and fetching someone else's report returns **403**.
- Login and registration are rate-limited (30 attempts / 15 min per IP). `GET /api/auth/me`
  is deliberately *not* limited, since it runs on every page load.
- Uploads are capped by count (10 + 1) and size, and filtered to image/video/audio types.
- CORS is restricted to `CORS_ORIGINS` in production; any LAN origin is allowed in development
  so a phone can connect.
- `.env` is git-ignored. **Rotate the MongoDB password before making this repo public** —
  the connection string has been shared in plain text.

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `EADDRINUSE :5000` | macOS AirPlay Receiver. This project uses 5050; disable AirPlay Receiver in System Settings → General → AirDrop & Handoff if you want 5000. |
| Camera/mic/GPS refuse on a phone | Not a secure context — use `npm run dev:web:https` or a tunnel (see §3). |
| "Cannot reach the server" | The API is not running, or `PORT` / the Vite proxy target disagree. |
| Sign-in says the account belongs to the admin dashboard | That email is an admin/staff record; use a citizen account. |
| Media 404s from the admin panel | GridFS URLs point at this API — it must be reachable from wherever the panel runs, or switch to Cloudinary. |
| Voice note shows `0:00` duration | A known `MediaRecorder` WebM quirk; playback still works. |
| Install sheet never appears | Only shows on HTTPS/localhost, only once per 7 days after "Not now", never when already installed, and never during the report wizard. Clear `evigilance.install.dismissedAt` in localStorage to see it again. |
| Phone offers "Add to Home screen" instead of "Install" | The origin is not trusted-secure. Plain HTTP *and* self-signed HTTPS both fail this test. Use Chrome port forwarding, a tunnel, or real TLS — see §3, and run `npm run check:install <url>` to confirm. |
| Installed app still shows browser bars | The manifest was not picked up at install time. Uninstall, hard-reload, confirm DevTools → Application → Manifest shows `display: standalone`, then reinstall. |
| Pages site loads but every API call fails | `CORS_ORIGINS` on the API does not include `https://<user>.github.io`, or `VITE_API_URL` was not set at build time. |
| Pages site is blank / assets 404 | Built without `BASE_PATH`. Use `npm run build:pages`, or let the workflow do it. |
| Evidence images broken on the Pages site | `PUBLIC_BASE_URL` is unset on the API, so GridFS URLs still say `localhost`. |
| "Evidence unavailable" on a report | The media file is missing — deleted from storage, or the API host in the URL is unreachable from where you are viewing. The rest of the report still renders. |
