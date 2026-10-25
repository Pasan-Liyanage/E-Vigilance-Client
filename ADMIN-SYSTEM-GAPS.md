# What the app lacks for the new admin system

**Date:** 24 October 2026 · **Compared against:** the agreed contract in the admin system's
`docs/11-citizen-app-integration.md`, with the reward, notification and privacy rules it
depends on (`docs/16`, `docs/09`, `docs/10`).

The new admin system (`E-Vigilence-Admin-Panel/New Backend`) is built and reads and writes the
shared database exactly as docs/11 says. When this list was written, the app still followed the
old three-status model. It worked, because the admin import accepts the old fields and maps
them, but most of what the new system offers citizens couldn't reach them:
- questions from HQ;
- the report timeline;
- rewards and payouts;
- account deletion.

Priorities:
- **P1** — needed before go-live; without it a feature is broken for citizens or reports are
  lost.
- **P2** — needed for the agreed rules, but the system copes without it for now.
- **P3** — quality and security improvements.

## Status (updated 24 October 2026)

All gaps in sections 1–5 are closed **except 2.3 and 5.3**, which are deferred (below). The
tables that follow are kept as the record of what was missing.

| # | Status | How |
|---|---|---|
| 1.1 | Done | The wizard keeps a `clientReportId` in its draft; the server returns the stored report (`200`, `duplicate: true`) when the same id arrives again, even when two arrive at once |
| 1.2 | Done | `GET /api/offences` reads `offence_schedule_public`; the citizen picks 1–5 and the app sends `offenceIds`. Until the police publish the list, the app falls back to the old phrases |
| 1.3 | Done | Camera captures send `capturedInApp: true` and `capturedAt`; gallery files `false`. Sent on both upload paths (R2 keys and multipart `evidenceMeta`) |
| 1.4–1.8 | Done | Injury question; 119 and honesty notices on the review step; `description` 10–2000 required; `occurredAt` within 30 days; GPS or a map pin required and checked to be inside Sri Lanka |
| 1.9 | Done | 20 reports per account per day, counted from midnight Colombo time; the 21st gets `429` with a plain message |
| 1.10 | Done | Photos 25 MB, audio 100 MB. Videos stay at the app's 50 MB upload cap (`MAX_UPLOAD_MB`), below the contract's 500 MB, as they are shrunk on the phone |
| 2.1, 2.2, 2.4 | Done | Report detail shows the police's timeline and reference number, and a reply box for an open question (one answer per question). The list and counters use stages: answer needed, being reviewed, closed |
| 2.3 | **Deferred** | See below |
| 3.1–3.4 | Done | Sign-up requires date of birth and a mobile number. NIC and phone are stored in one canonical form; `nicVerified` is set when the NIC's birth date matches; the phone is verified with a 6-digit code (10 minutes, 5 tries, one code a minute). Passwords: 8 or more, common ones refused |
| 4.1–4.4 | Done | Rewards page: balance, points, payouts, eligibility checklist, and "Ask for a payout" (bank or mobile wallet, one open request at a time). Suspended accounts can't send reports; frozen or excluded rewards hide the payout form |
| 5.1 | Done | Profile → Delete my account, confirmed with the password. Personal details are removed, sign-in stops, and `account_deletions` is written in the same transaction |
| 5.2 | Done, off by default | `MEDIA_ACCESS=signed` serves media only through links signed for the owner (valid one hour) and to the admin import's `X-Media-Key`. It stays `public` until the previous admin panel, which shows evidence straight from these links, is retired |
| 5.3 | **Deferred** | See below |

**Deferred, and why**

- **2.3 Notifications.** Web Push needs VAPID keys and a long-running worker watching
  `report_updates`; the app is also deployed as serverless functions, where that worker can't
  run. Citizens see updates when they open the app. Plan it with the hosting decision.
- **5.3 Token storage.** Moving the session to an HttpOnly cookie changes how the app and the API
  talk across origins (CORS with credentials, CSRF protection) and would sign everyone out. It is
  worth doing as its own change, tested on every host the app runs on.

**Settings needed before go-live**

- **Text messages.** Phone codes are only written to the server log (`SMS_PROVIDER=console`,
  for development). In production set `SMS_PROVIDER=none` until a provider is chosen. Until then
  nobody can verify a phone, so **nobody is eligible for rewards**. Choosing the provider is the
  next step for rewards. For demonstrations, `SMS_PROVIDER=demo` shows the code in the app
  instead of texting it (DEMO.md); never use it where real citizens sign up.
- **Evidence links.** Generate `MEDIA_SERVICE_KEY` here and set the same value as the admin
  backend's `APP_MEDIA_KEY`. When this app uses R2, add `.r2.cloudflarestorage.com` to the admin
  backend's `APP_MEDIA_ALLOWED_HOSTS`, because the app's media links redirect there.
- **Shared database** (6.1–6.3) is unchanged and still to do.

---

## 1. Sending a report (`reports`)

| # | Gap | Contract (docs/11 §4) | The app today | What to change | Priority |
|---|---|---|---|---|---|
| 1.1 | **No `clientReportId`** | Required, unique per device; a re-sent report is recognised and ignored | Not sent. A double tap, a retry after a timeout, or a resend from the draft makes two reports | Generate a UUID when the wizard starts, keep it in the draft, and send it with the report; return the existing report if the same id arrives again | **P1** |
| 1.2 | **Free-text offences** | `offenceIds` chosen from `offence_schedule_public` (codes); no free text (D11-6) | `issueType` from a hard-coded list of 14 phrases, including "Other" | Read `offence_schedule_public` (`code`, `name`, `description`, `vehicleTypes`, `sortOrder`) through a new `GET /api/offences`, let the citizen pick one or more, and send `offenceIds: [code, …]`. Today unmatched text arrives flagged "offence not recognised" and HQ has to fix it by hand | **P1** |
| 1.3 | **Gallery or camera isn't recorded** | Each `evidence[]` item has `capturedInApp` (and `capturedAt`) (D11-4) | The app knows whether a file came from `CameraCapture` or the file picker, but doesn't say | Add `capturedInApp: true/false` and `capturedAt` to each media item. Until then every file arrives as "picked from the gallery" and is flagged in triage | **P1** |
| 1.4 | **No injury question** | `injuries: true` makes a report P1 (2-hour triage) | Not asked | Add "Was anyone hurt?" to the wizard and send `injuries` | **P1** |
| 1.5 | **No 119 and honesty notice before sending** | Shown before sending: "If someone is in danger right now, call 119", and that false or edited reports are rejected and can lead to suspension | 119 appears only on the Info page | Add both lines to the review step, above the Send button | P2 |
| 1.6 | **Description** | `description`, 10–2000 characters | `additionalDetails`, optional, up to 1000 | Rename to `description` (the import reads either), require at least 10 characters, and allow 2000 | P2 |
| 1.7 | **Time window** | `occurredAt` not in the future and **within 30 days** | Only "not in the future"; the field is `dateTime` | Refuse dates older than 30 days in the wizard; reports older than that are rejected on import as "too old". Optionally rename to `occurredAt` (the import reads either) | P2 |
| 1.8 | **Place** | GPS required unless set on a map; inside Sri Lanka | GPS optional; any coordinates accepted | Require GPS or a map pin, and check it falls inside Sri Lanka (the import rejects places outside) | P2 |
| 1.9 | **Daily limit** | 20 reports per account per day (D11-5) | No limit | Count today's reports per user on the server and refuse the 21st with a clear message | P2 |
| 1.10 | **File size limits** | Photos 25 MB, videos 500 MB, audio 100 MB | One 50 MB limit (videos are compressed first) | Align the limits per kind | P3 |

## 2. Following a report (`report_updates`, `report_replies`)

| # | Gap | Contract (docs/11 §5) | The app today | What to change | Priority |
|---|---|---|---|---|---|
| 2.1 | **The timeline isn't shown** | The app reads `report_updates` (`type`, `title`, `message`, `question`, `reportNumber`, `at`) and shows each update as is | Shows only `reports.status` ("In Progress", "Completed", "Rejected"), which the admin system keeps up to date during the change-over | Add `GET /api/reports/:id/updates` and show the timeline on Report detail: received, needs information, under review, action taken, closed with no action, rejected with the reason, and reward lines. Show our number (`RP-2026-…`) | **P1** |
| 2.2 | **No way to answer a question** | When HQ asks (`needs_info`), the citizen replies; the app writes `report_replies` (`reportId`, `userId`, `answer` ≤ 1000, `createdAt`) | Not possible | Show the question with a reply box, and write the answer to `report_replies`. **Without this, every report HQ asks about is rejected after 7 days as "no response"** | **P1** |
| 2.3 | **No notifications** | The app's backend sends a push notification for each new update (docs/09 §5.3) | None | Web Push for the installed app: store each device's subscription, and send when a new `report_updates` document appears (poll it, or use a change stream) | P2 |
| 2.4 | **Report list filters** | — | Filters by the three old statuses | Filter by the latest update instead (waiting for you, under review, closed) | P3 |

## 3. Identity (`users`)

| # | Gap | Contract (docs/11 §6, docs/16 §3) | The app today | What to change | Priority |
|---|---|---|---|---|---|
| 3.1 | **Nobody can earn rewards** | The admin system pays rewards only to accounts with `phoneVerified: true`, `nicVerified: true` and a `dateOfBirth` showing 18 or over | None of these fields exist, so **every citizen is "not eligible"** | Add phone verification by one-time SMS code (sets `phoneVerified`); a NIC check (format, matches the date of birth inside the NIC) that sets `nicVerified`; and `dateOfBirth` on sign-up | **P1** (for rewards) |
| 3.2 | **Phone optional** | Needed for "needs information" SMS (D09-4), payouts, and the self-report check | Optional | Make the phone required (and verified, 3.1) | P2 |
| 3.3 | **NIC format** | Old (9 digits + V/X) or new (12 digits) | Any text; uniqueness only | Validate and store in one canonical form, so the same NIC can't sign up twice with different spacing | P2 |
| 3.4 | **Weak passwords** | — | 6 characters minimum | 8 or more, and refuse common passwords | P3 |

## 4. Rewards and payouts (`reward_accounts`, `payout_requests`)

| # | Gap | Contract (docs/11 §6, docs/16 §6–§8) | The app today | What to change | Priority |
|---|---|---|---|---|---|
| 4.1 | **No rewards screen** | The citizen sees their balance and each reward line | Nothing about rewards | Read `reward_accounts` for the user and show: `balance` (`pending`, `available`, `inPayout`, `paidOut`, `expiringSoon`); `ledger` (report number, points, status, message); and `payouts` (status and message) | **P1** (for rewards) |
| 4.2 | **No payout request** | The app writes `payout_requests`: `userId` (string), `method` (`bank` or `wallet`), `accountNumber` or `walletNumber`, `createdAt` | Not possible | Add "Ask for a payout" when `available` ≥ 100 points; never show the full account number again after saving (docs/10 §5.3). The admin system pays in weekly batches (simulated for now) and answers through `reward_accounts.payouts` | **P1** (for rewards) |
| 4.3 | **Suspension not enforced** | A `suspended` citizen can't send reports; the app enforces it (the import also rejects them) | Not checked | Before showing the wizard and on submit, read `reward_accounts.status`; when `suspended`, explain plainly and don't send | **P1** |
| 4.4 | **Frozen or excluded rewards** | — | — | When `reward_accounts.rewards.frozen` or `excluded` is set, hide "Ask for a payout" and say rewards are under review | P2 |

## 5. Privacy (docs/10)

| # | Gap | Contract | The app today | What to change | Priority |
|---|---|---|---|---|---|
| 5.1 | **No account deletion** | The citizen can delete their account; the app writes `account_deletions` (`userId`, `deletedAt`); reports stay as police records, unpaid points lapse (docs/10 §5.5) | Not possible (needed under the Personal Data Protection Act No. 9 of 2022) | Add "Delete my account" to Profile, with a confirmation that explains reports stay with the police. Disable sign-in for the account and write `account_deletions`. The admin system does the rest | **P1** |
| 5.2 | **Evidence links are public** | Evidence is never shown to the public (docs/10 E2) | `/api/media/r2/…` is public, and an unguessable link is the only protection | Serve media only to the signed-in owner, or through short-lived signed links. The admin system downloads each file once on import, so it needs one working link at that moment | P2 |
| 5.3 | **Sign-in token in `localStorage` for 7 days** | — | Any script on the page could read it | Use an HttpOnly cookie, or a shorter token with refresh | P3 |
| 5.4 | Evidence never deleted after sending | Hide only, never delete (D11-7) | ✓ Already right: there is no delete; files are removed only when an upload fails | Keep it that way | — |

## 6. Shared database and settings (both systems)

| # | Gap | Rule | Today | What to do | Owner |
|---|---|---|---|---|---|
| 6.1 | **One writer per collection** | Each system's database user writes only its own collections (D11-2) | Both use one full-access connection | Create two Atlas users. **App:** writes `users`, `reports`, `report_replies`, `payout_requests`, `account_deletions`, and reads the rest. **Admin:** writes `report_updates`, `reward_accounts`, `offence_schedule_public`, its own collections, and `reports.status` during the change-over (docs/11 §9) | You (Atlas) |
| 6.2 | **Same database** | Both on one database | The app uses `MONGO_DB_NAME` or the name in `MONGO_URI` (default `evigilence`) | Set the admin backend's `MONGODB_DB_NAME` to the same database | You |
| 6.3 | **Media host allowed** | The admin import downloads evidence only from listed hosts | — | Set the admin backend's `APP_MEDIA_BASE_URL` and `APP_MEDIA_ALLOWED_HOSTS` to this app's media origin (and the R2 public host, if used) | You |
| 6.4 | Staff accounts in `users` | The new admin system keeps staff in `staff_accounts` | The app's sign-in still guards against old staff accounts in `users` | Harmless; remove the guard once the old admin panel is retired | App, later |

## 7. Already in place

- Camera capture and voice notes; photo compression and video shrinking on the phone.
- Direct upload to R2, with keys checked on the server.
- Drafts that survive a reload; the installable app; light and dark themes.
- NIC uniqueness, and login rate limits.
- The Info page in English, Sinhala and Tamil, with the 119 number.
- Evidence is never deleted after sending.

## 8. What is left

1. **A text-message provider** for phone codes. Without one, nobody can receive rewards.
2. **Shared database permissions and settings** (6.1–6.3), and the evidence-link settings
   listed under Status.
3. **Notifications** (2.3), after the hosting decision.
4. **Token storage** (5.3), as its own change.
5. Switch to `MEDIA_ACCESS=signed` once the previous admin panel is retired.

Any change to the contract itself needs both teams' agreement (D11-8): update docs/11 in the
admin repository, and this file, together.
