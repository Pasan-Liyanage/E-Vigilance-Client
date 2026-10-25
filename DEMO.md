# Running a demo

How to show E-Vigilance end to end without paying for text messages: a citizen sends a report
in this app, the police work on it in the admin system, and the citizen sees every step.

## 1. Settings

In `server/.env`:

```
SMS_PROVIDER=demo
```

In demo mode no text message is ever sent. When a citizen asks for a phone verification code,
the app shows the code on screen in a box marked **Demo mode**. Everything else about the code
is real: it is random, expires after 10 minutes, allows 5 tries, and a new one can be asked for
once a minute. The server prints a warning on every start while demo mode is on.

**Demo mode is for demonstrations only.** Never leave it on where real citizens sign up: anyone
could verify any number. For real use, set a text-message provider (or `SMS_PROVIDER=none`).

Both systems must use the same database (`MONGO_URI` / `MONGO_DB_NAME` here, `MONGODB_URI` /
`MONGODB_DB_NAME` in the admin backend), and the admin backend must be running, because it
imports the app's reports every minute.

## 2. Demo data

From `server/`:

```
npm run seed:demo
```

This creates one citizen and three reports (a red light in Colombo, phone use on a bus in Kandy,
and a three-wheeler in Galle). It writes only this app's own data; within a minute the admin
system imports the reports and the citizen sees "Received" on each. Running it again changes
nothing.

| | |
|---|---|
| Email | `citizen.demo@example.com` |
| Password | `Demo-Citizen-2026` (or `DEMO_PASSWORD` from `server/.env`) |

To show phone verification again after a run-through:

```
npm run seed:demo -- --unverify
```

## 3. A suggested walkthrough (about 10 minutes)

**In the app (on a phone, or a browser at phone width):**

1. **Sign in** as the demo citizen. The dashboard shows the three reports and their progress.
2. **Profile → Verify your mobile number → Send code.** The code appears in the demo box; enter
   it. The profile now shows *Mobile verified* and *NIC confirmed*.
3. **Rewards.** The checklist is complete, so the citizen can receive rewards.
4. **New report.** Take a photo with the in-app camera, enter a plate, choose one or more
   offences, answer "Was anyone hurt?", pin the place, describe what happened, and send. Point
   out the 119 notice and the honesty notice on the review step.

**In the admin system:**

5. Within a minute the new report appears in **triage**. Photos chosen from the gallery are
   marked "picked from the phone's gallery"; photos taken with the app's camera are not. (Photos
   are copied over only when the app runs on `https`; see Tips.)
6. Open one of the demo reports and, from its actions, choose **Ask the reporter**, for example
   "Which direction was the vehicle going?"

**Back in the app:**

7. The report now shows **Answer needed**, with the police's question and a reply box. Answer it.

**In the admin system:**

8. The answer appears on the report. Take the report's next action and continue the case. Each
   step the police take appears on the citizen's timeline with the police reference number
   (`RP-…`).

Reward points appear on the citizen's Rewards page once a case is decided with enforcement (a
penalty notice or a court referral), and become available to pay out once that is settled.

## 4. Tips

- Use a phone, or the browser's device mode, so the app looks as citizens see it. The camera
  and GPS need `https` or `localhost` (README §3 covers testing on a real phone).
- Evidence photos are copied into the admin system only over `https`. When both systems run on
  `localhost`, reports arrive without their photos and are flagged "evidence download failed";
  everything else works. Deploy the app (README §7) to show evidence in the admin system too.
- After the demo, switch `SMS_PROVIDER` back before anyone else signs up.
