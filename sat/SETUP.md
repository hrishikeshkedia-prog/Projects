# SAT Prep Platform — Setup Guide

This app is a static site (plain HTML/JS, no build step) that talks directly
to Firebase (Auth + Firestore) from the browser. You can host it anywhere
static files work — GitHub Pages, Netlify, Vercel, etc.

The Firebase SDK and Chart.js are vendored locally under `vendor/` (not
loaded from a CDN), so the app has no external script dependency besides
Desmos, which can only run as a live embed from desmos.com (there's no
self-hosted version of their calculator).

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com and create a new project (the
   free "Spark" plan is enough to start).
2. In **Build → Authentication → Sign-in method**, enable **Email/Password**.
3. In **Build → Firestore Database**, click **Create database** (start in
   production mode — the rules below lock it down properly).
4. In **Project settings → General → Your apps**, click the **</>** (web)
   icon to register a web app. Copy the `firebaseConfig` object it gives you.
5. Paste those values into `js/firebase-config.js`, replacing the
   `REPLACE_ME` placeholders.

## 2. Deploy security rules & indexes

From the `sat/` folder, with the [Firebase CLI](https://firebase.google.com/docs/cli)
installed (`npm install -g firebase-tools`):

```
firebase login
firebase use --add        # pick your project, give it an alias like "default"
firebase deploy --only firestore:rules,firestore:indexes
```

This uploads `firestore.rules` (users can only read/write their own data;
only the seed script can write questions) and `firestore.indexes.json`
(the composite indexes the random-question-picker queries need).

## 3. Load the question bank

The app ships with ~34 sample questions (`data/sample-questions.json`) so
you can try everything immediately. To load real questions:

1. Get a Firebase service account key: **Project settings → Service accounts
   → Generate new private key**. Save the JSON file somewhere safe (never
   commit it).
2. Format your questions as a JSON array matching the schema in
   `data/sample-questions.json` (each question needs `id`, `subject`
   `"math"|"rw"`, `domain`, `skill`, `difficulty` `"E"|"M"|"H"`, `prompt`,
   `choices` (array of `{key, text}`), `answer`, `explanation`, and
   optionally `passage` / `calculatorAllowed`).
3. Run the seed script:
   ```
   cd scripts
   npm install
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
     node seed-questions.js /path/to/your-questions.json
   ```
   Re-running with updated data safely overwrites existing questions
   (matched by `id`) instead of duplicating them.

   If your question bank is a PDF or pasted text rather than structured
   JSON, ask Claude to convert a batch into this JSON schema before seeding
   — that conversion needs a human/LLM pass since raw text won't reliably
   auto-parse into passage/choices/answer/explanation fields.

## 4. Desmos calculator

The app uses a demo Desmos API key by default (`js/firebase-config.js` →
`DESMOS_API_KEY`), which is rate-limited and fine for development only.
Get a free key at https://www.desmos.com/api for production use and swap
it in.

## 5. Run it locally

No build step — just serve the folder statically, e.g.:

```
cd sat
python3 -m http.server 8000
```

Then open http://localhost:8000. When `js/firebase-config.js` still has
`USE_EMULATORS_ON_LOCALHOST = true` (the default) and you're on
`localhost`/`127.0.0.1`, the app automatically talks to local Firebase
Emulators instead of production — handy for development without touching
real data:

```
firebase emulators:start
# in another terminal, seed the emulator (no real credentials needed):
cd scripts && npm install
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node seed-questions.js ../data/sample-questions.json <your-project-id>
```

## 6. Deploy

Any static host works. For GitHub Pages, commit the `sat/` folder and
enable Pages on the repo (root or `/sat` as the site source, or move these
files to their own repo/branch if you want them at the domain root).

## Data model

- `questions/{questionId}` — the question bank. Public-read (signed-in
  users only), write-only via the Admin SDK seed script.
- `users/{uid}` — profile (`displayName`, `email`).
- `users/{uid}/attempts/{attemptId}` — one doc per completed test: mode,
  timing, score, per-domain/per-skill breakdown, and the question IDs +
  selected answers (so `review.html` can re-render a full review later).

## Known limits / possible next steps

- Multiple-choice only — no student-produced-response (grid-in) math
  questions yet. Would need a text-input answer type in the schema and UI.
- "Full test" / "section" modes draw a domain-weighted random sample each
  time rather than truly adaptive module 2 difficulty (the real digital
  SAT adjusts module 2's difficulty based on module 1 performance).
- No password-less/SSO login — email+password only.
