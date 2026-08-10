#!/usr/bin/env node
// Bulk-imports a question bank JSON file into the Firestore `questions`
// collection using the Admin SDK (bypasses security rules, so this is the
// only supported way to write questions).
//
// Usage:
//   npm install                     (once, inside scripts/)
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
//     node seed-questions.js ../data/sample-questions.json
//
// Or against the local emulator (no real credentials needed):
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node seed-questions.js ../data/sample-questions.json my-project-id
//
// Each question must match the schema documented in ../data/sample-questions.json:
//   { id, subject: "math"|"rw", domain, skill, difficulty: "E"|"M"|"H",
//     calculatorAllowed, passage, prompt, choices: [{key,text}...], answer, explanation }
//
// The doc ID in Firestore is set to the question's own `id`, so re-running
// this script with updated data safely overwrites existing questions
// instead of duplicating them.

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const filePath = process.argv[2] || path.join(__dirname, "..", "data", "sample-questions.json");
const projectId = process.argv[3];

if (!fs.existsSync(filePath)) {
  console.error(`Question file not found: ${filePath}`);
  process.exit(1);
}

const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
if (usingEmulator) {
  admin.initializeApp({ projectId: projectId || "demo-sat-prep" });
  console.log(`Seeding against Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
} else {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      "Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account key JSON path, " +
        "or set FIRESTORE_EMULATOR_HOST to seed the local emulator instead."
    );
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  console.log("Seeding against production Firestore.");
}

const db = admin.firestore();

const REQUIRED_FIELDS = ["id", "subject", "domain", "skill", "difficulty", "prompt", "choices", "answer", "explanation"];
const VALID_SUBJECTS = ["math", "rw"];
const VALID_DIFFICULTIES = ["E", "M", "H"];

function validate(q, index) {
  const errors = [];
  for (const field of REQUIRED_FIELDS) {
    if (q[field] === undefined || q[field] === null || q[field] === "") errors.push(`missing "${field}"`);
  }
  if (q.subject && !VALID_SUBJECTS.includes(q.subject)) errors.push(`invalid subject "${q.subject}"`);
  if (q.difficulty && !VALID_DIFFICULTIES.includes(q.difficulty)) errors.push(`invalid difficulty "${q.difficulty}"`);
  if (q.choices && (!Array.isArray(q.choices) || q.choices.length < 2)) errors.push("choices must be an array of 2+ items");
  if (q.choices && q.answer && !q.choices.some((c) => c.key === q.answer)) errors.push(`answer "${q.answer}" not among choice keys`);
  if (errors.length) return `Question at index ${index} (id: ${q.id || "?"}): ${errors.join("; ")}`;
  return null;
}

async function main() {
  const raw = fs.readFileSync(filePath, "utf8");
  const questions = JSON.parse(raw);
  if (!Array.isArray(questions)) {
    console.error("Question file must contain a JSON array.");
    process.exit(1);
  }

  const problems = questions.map(validate).filter(Boolean);
  if (problems.length) {
    console.error(`Found ${problems.length} invalid question(s):`);
    problems.slice(0, 20).forEach((p) => console.error("  - " + p));
    if (problems.length > 20) console.error(`  ...and ${problems.length - 20} more`);
    process.exit(1);
  }

  const ids = new Set();
  for (const q of questions) {
    if (ids.has(q.id)) {
      console.error(`Duplicate question id in file: ${q.id}`);
      process.exit(1);
    }
    ids.add(q.id);
  }

  console.log(`Validated ${questions.length} questions. Uploading in batches of 400…`);

  const BATCH_SIZE = 400;
  let written = 0;
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const chunk = questions.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const q of chunk) {
      const { id, ...data } = q;
      const ref = db.collection("questions").doc(id);
      batch.set(ref, { ...data, rand: Math.random(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  ${written}/${questions.length} uploaded`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
