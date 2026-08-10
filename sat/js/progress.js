import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit as fsLimit,
  serverTimestamp
} from "../vendor/firebase/firebase-firestore.js";
import { db } from "./firebase-init.js";

export async function saveAttempt(uid, session, scoreResult) {
  const ref = doc(collection(db, "users", uid, "attempts"));
  const questionIds = session.modules.flatMap((m) => m.questions.map((q) => q.id));
  const answers = {};
  for (const [qid, entry] of Object.entries(session.answers)) {
    answers[qid] = { selected: entry.selected || null };
  }
  const record = {
    mode: session.mode,
    timed: session.timed,
    startedAt: session.startedAt,
    submittedAt: session.submittedAt,
    durationSec: Math.round((session.submittedAt - session.startedAt) / 1000),
    correct: scoreResult.correct,
    total: scoreResult.total,
    percent: scoreResult.percent,
    byDomain: scoreResult.byDomain,
    bySkill: scoreResult.bySkill,
    subjects: [...new Set(session.modules.map((m) => m.subject))],
    questionIds,
    answers,
    createdAt: serverTimestamp()
  };
  await setDoc(ref, record);
  return ref.id;
}

export async function fetchAttempt(uid, attemptId) {
  const snap = await getDoc(doc(db, "users", uid, "attempts", attemptId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchAttempts(uid, max = 200) {
  const q = query(collection(db, "users", uid, "attempts"), orderBy("submittedAt", "desc"), fsLimit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function summarizeAttempts(attempts) {
  const totalTests = attempts.length;
  const totalQuestions = attempts.reduce((s, a) => s + a.total, 0);
  const totalCorrect = attempts.reduce((s, a) => s + a.correct, 0);
  const overallAccuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const domainAgg = {};
  const skillAgg = {};
  for (const a of attempts) {
    for (const d of a.byDomain || []) {
      const k = `${d.subject}:${d.label}`;
      domainAgg[k] = domainAgg[k] || { label: d.label, subject: d.subject, correct: 0, total: 0 };
      domainAgg[k].correct += d.correct;
      domainAgg[k].total += d.total;
    }
    for (const s of a.bySkill || []) {
      skillAgg[s.label] = skillAgg[s.label] || { label: s.label, correct: 0, total: 0 };
      skillAgg[s.label].correct += s.correct;
      skillAgg[s.label].total += s.total;
    }
  }

  const byDomain = Object.values(domainAgg).map((d) => ({
    ...d,
    accuracy: d.total ? Math.round((d.correct / d.total) * 100) : 0
  }));
  const weakestSkills = Object.values(skillAgg)
    .map((s) => ({ ...s, accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0 }))
    .filter((s) => s.total >= 2)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  const trend = attempts
    .slice()
    .sort((a, b) => a.submittedAt - b.submittedAt)
    .map((a) => ({ date: a.submittedAt, percent: a.percent }));

  return { totalTests, totalQuestions, totalCorrect, overallAccuracy, byDomain, weakestSkills, trend };
}
