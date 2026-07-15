# Brain Mantra

A web app for running a 100-day abacus mental-math challenge: students register with name,
mobile number, and skill level; each day unlocks a one-time Google Form questionnaire matched
to their level; a streak corner tracks consecutive days completed; and a weekly leaderboard
ranks the top 3 students by accuracy and speed.

## Stack

- **Frontend:** React 19 + Vite, React Router, plain CSS (no framework)
- **Backend:** Node.js + Express + MongoDB (Mongoose)
- **Forms:** Google Forms embedded via iframe, one per level (optionally per day)
- **Scheduling:** `node-cron` nightly job to lock/break streaks at midnight

## Project structure

```
/                          frontend root (Vite)
  index.html
  vite.config.js
  package.json
  src/
    main.jsx               React entry point
    App.jsx                Router setup
    index.css               global design tokens & utility classes
    context/
      AuthContext.jsx       student session (localStorage + backend re-verify)
    utils/
      api.js                axios instance
      dateUtils.js          challenge-day math (frontend)
      formsConfig.js        ⚠️ EDIT THIS — Google Form URLs per level
    components/
      StreakCorner.jsx/css
      DayCard.jsx/css
    pages/
      SignupPage.jsx/css     registration + login tabs
      WelcomePage.jsx/css    10s verified-welcome screen
      ChallengePage.jsx/css  100-day grid + streak corner
      DayModal.jsx/css       one-time form embed flow
      LeaderboardPage.jsx/css
      NotFoundPage.jsx

api/                        backend root (Express)
  server.js                 app entry point
  package.json
  .env.example               ⚠️ COPY TO .env AND FILL IN
  models/
    Student.js               Mongoose schema
  routes/
    students.js               register/login/progress endpoints
    leaderboard.js             weekly leaderboard endpoint
  utils/
    dateHelpers.js
    streak.js                 streak calculation logic
    googleSheet.js             optional CSV fallback verification
  jobs/
    streakCron.js              nightly streak-break job
```

## 1. Configure your Google Forms

Open `src/utils/formsConfig.js` and replace the placeholder URLs:

1. For each level's Google Form, click **Send → embed (`<>`) tab** and copy the `src` URL
   from the iframe code (ends in `?embedded=true`).
2. Paste it into `FORM_CONFIG[level].defaultFormUrl`.
3. If a level needs a *different* form per day, add entries to `FORM_CONFIG[level].days`,
   e.g. `days: { 5: 'https://docs.google.com/forms/d/e/.../viewform?embedded=true' }`.
4. Optionally set `REGISTRATION_FORM_URL` if you still want to link out to a Google Form
   for manual registration (the app's own signup page is the primary path).

### Important Google Forms limitation

Google Forms does not give cross-origin JavaScript any way to detect a successful
submission inside an iframe. The app handles this by:
- Marking a day **"opened"** the instant the student clicks "I'm ready, start" (consuming
  the one-time link immediately — this satisfies "the link can only be accessed once").
- Asking the student to click **"I've submitted the form"** after they finish, which calls
  `POST /api/students/:id/progress/:day/complete` and marks the day fully completed.
- If you want server-verified completion instead of student self-report, set up a Google
  Apps Script trigger (`onFormSubmit`) on each form that POSTs the response to a webhook
  you add to the API (e.g. `/api/webhooks/form-submit`), matching by mobile number, and
  optionally including computed `accuracy` / `timeTakenSeconds` for the leaderboard. This
  repo's `Student.days[].accuracy` / `timeTakenSeconds` fields are ready to receive that
  data — you only need to add the webhook route and call `applyStreak()` afterward.

## 2. Backend setup

```bash
cd api
cp .env.example .env
# edit .env: set MONGODB_URI (MongoDB Atlas free tier works fine), CORS_ORIGIN, etc.
npm install
npm run dev
```

The API runs on `http://localhost:5000` by default and exposes:

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/students/register` | Create a student (name, mobile, level) |
| POST | `/api/students/login` | Look up a student by mobile (re-entry) |
| GET | `/api/students/:id` | Re-verify a stored session |
| GET | `/api/students/:id/progress` | All day records + streak |
| GET | `/api/students/:id/progress/:day` | Single day record |
| POST | `/api/students/:id/progress/:day/open` | Mark day opened (one-time) |
| POST | `/api/students/:id/progress/:day/complete` | Mark day completed |
| GET | `/api/leaderboard/weekly?level=` | Weekly top performers |

## 3. Frontend setup

```bash
# from project root
cp .env.example .env
npm install
npm run dev
```

Visit `http://localhost:5173`. The Vite dev server proxies `/api/*` to
`http://localhost:5000` (see `vite.config.js`), so you usually don't need to touch
`VITE_API_URL` in development — only set it in `.env` for production if your frontend
and backend are deployed to different domains.

## 4. How the core flows work

**Registration check + welcome screen (spec #6):** On the signup page, a student either
registers fresh or logs in with their mobile number. `WelcomePage` only renders after
`AuthContext` has a verified student object from the backend — if a mobile number isn't
found, `/api/students/login` returns 404 and the signup page shows an error pointing the
student back to registration (and optionally to the raw Google Form via
`REGISTRATION_FORM_URL`). On success, `WelcomePage` shows a 10-second confirmation
animation before auto-redirecting to `/challenge` (or the student can skip immediately).

**Day-by-day unlocking (spec #2, #3):** `getChallengeDay()` computes the active day as
`(today − registrationDate) + 1`, so Day 1 always starts on the registration date. Each
`DayCard` in the 100-day grid is locked, active, completed, or missed based on comparing
its calendar date to today and to the student's `days[]` records:
- **Locked** — future day, not clickable.
- **Active (today)** — clickable, opens the one-time confirmation + embedded form.
- **Opened, not submitted** — shown once the student leaves without confirming submission;
  the link cannot be reopened (`/open` returns 409 if already opened).
- **Completed** — shown after the student confirms submission.
- **Missed** — past day that was never opened; the nightly cron (`jobs/streakCron.js`) and
  the `isDayPast` check on the frontend both reflect this automatically at midnight, with
  no separate "disable" step needed since the date comparison itself locks it.

**Streak corner (spec #4):** `recalculateStreak()` walks every elapsed day from
registration to today, counting consecutive `completed` days from the most recent backwards,
and resets to 0 the moment a past day without `completed=true` is encountered. This runs
both on-demand (every time `/progress` is fetched) and nightly via cron, so streaks break
automatically at midnight if a student missed the prior day.

**Weekly leaderboard (spec #5):** `/api/leaderboard/weekly` aggregates each student's day
records completed within the current Monday–Sunday window, averages their `accuracy` and
`timeTakenSeconds`, and sorts by accuracy descending, then average time ascending. The top
3 are rendered on a podium; the rest in a ranked list. **Note:** `accuracy` and
`timeTakenSeconds` are not collected by the manual "I've submitted" confirmation alone — wire
up the Apps Script webhook described above (or extend the confirm button to accept manual
entry) to populate real values; otherwise the leaderboard will show "no completed challenges
this week" since rows without an `accuracy` value are excluded from ranking.

## 5. Deployment

- **Frontend:** `vercel.json` is set up for Vercel static deployment of the Vite build
  (`npm run build` → `dist/`), with SPA rewrites so client-side routing works.
- **Backend:** Deploy `api/` separately (Render, Railway, Fly.io, or a small VPS) since it
  needs a persistent Node process for `node-cron` and a MongoDB connection. Point the
  frontend's `VITE_API_URL` at that deployed API's `/api` base URL.

## 6. Customization notes

- Update `LEVELS` in `src/utils/formsConfig.js` if your level names/descriptions differ.
- Colors, type, and the abacus-bead motif live in `src/index.css` (`:root` custom
  properties) — change `--navy` / `--amber` / `--ivory` to re-theme everything at once.
- `CHALLENGE_DAYS` env var on the backend is present for future flexibility but the
  frontend currently hardcodes 100 days in `ChallengePage.jsx` (`Array.from({ length: 100 })`)
  per the spec; update both if you need a different challenge length.
