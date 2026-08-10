import {
  collection,
  query,
  where,
  orderBy,
  startAt,
  limit,
  getDocs,
  documentId
} from "../vendor/firebase/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { DOMAINS, DOMAIN_WEIGHTS, MODULE_STRUCTURE } from "./constants.js";

const QUESTIONS = "questions";

/**
 * Fetch up to `count` random questions matching equality filters, using the
 * "random field + orderBy + wraparound" pattern so this scales to a
 * question bank of thousands of docs without reading the whole collection.
 * Every seeded question doc must carry a numeric `rand` field in [0, 1).
 */
async function fetchRandom(filters, count, excludeIds = new Set()) {
  if (count <= 0) return [];
  const base = [collection(db, QUESTIONS), ...filters];
  const seed = Math.random();

  async function run(cursor) {
    const q = query(...base, orderBy("rand"), startAt(cursor), limit(count * 2 + excludeIds.size));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  let results = await run(seed);
  if (results.length < count) {
    // Wrap around to the start of the [0, 1) range.
    const q2 = query(...base, orderBy("rand"), limit(count * 2 + excludeIds.size));
    const snap2 = await getDocs(q2);
    results = results.concat(snap2.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  const seen = new Set(excludeIds);
  const unique = [];
  for (const r of results) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    unique.push(r);
    if (unique.length >= count) break;
  }
  return unique;
}

function buildFilters({ subject, domain, difficulties }) {
  const filters = [];
  if (subject && subject !== "both") filters.push(where("subject", "==", subject));
  if (domain) filters.push(where("domain", "==", domain));
  if (difficulties && difficulties.length > 0 && difficulties.length < 3) {
    filters.push(where("difficulty", "in", difficulties));
  }
  return filters;
}

/** Pull a domain-weighted random set of `count` questions for one subject. */
export async function weightedSetForSubject(subject, count, { difficulties, excludeIds } = {}) {
  const domains = DOMAINS[subject];
  const weights = DOMAIN_WEIGHTS[subject];
  const excluded = new Set(excludeIds || []);

  const targetCounts = domains.map((d) => Math.round(weights[d] * count));
  // Fix rounding drift so the total matches `count` exactly.
  let drift = count - targetCounts.reduce((a, b) => a + b, 0);
  let i = 0;
  while (drift !== 0) {
    targetCounts[i % domains.length] += drift > 0 ? 1 : -1;
    drift += drift > 0 ? -1 : 1;
    i++;
  }

  const picked = [];
  for (let idx = 0; idx < domains.length; idx++) {
    const domain = domains[idx];
    const want = targetCounts[idx];
    if (want <= 0) continue;
    const filters = buildFilters({ subject, domain, difficulties });
    const qs = await fetchRandom(filters, want, excluded);
    qs.forEach((q) => excluded.add(q.id));
    picked.push(...qs);
  }

  // Top up from the whole subject if any domain bucket came up short
  // (e.g. the sample bank doesn't yet have enough questions in it).
  if (picked.length < count) {
    const filters = buildFilters({ subject, difficulties });
    const more = await fetchRandom(filters, count - picked.length, excluded);
    more.forEach((q) => excluded.add(q.id));
    picked.push(...more);
  }

  // Last resort for a bank too small to fill this module uniquely (e.g. a
  // sample/dev bank, or a later module whose earlier siblings already used
  // up every question for this subject): drop the exclusion entirely and
  // repeat questions rather than hand back an empty or short module, which
  // would otherwise crash the test-taking UI. Irrelevant once the bank has
  // thousands of real questions.
  if (picked.length === 0) {
    const filters = buildFilters({ subject, difficulties });
    const anyAvailable = await fetchRandom(filters, count, new Set());
    picked.push(...anyAvailable);
  }
  if (picked.length > 0) {
    let idx = 0;
    while (picked.length < count) {
      picked.push(picked[idx % picked.length]);
      idx++;
    }
  }

  return shuffle(picked);
}

/** Random set of `count` questions, optionally spanning both subjects. */
export async function customSet({ subjects, domains, difficulties, count }) {
  const excluded = new Set();
  const picked = [];
  const perSubject = Math.ceil(count / subjects.length);

  for (const subject of subjects) {
    // A caller-supplied domain list may span multiple subjects (e.g. the
    // Quick 10 picker defaults to "all domains of all chosen subjects") —
    // only keep the ones that actually belong to this subject, otherwise
    // we waste query slots filtering on domain names this subject never has.
    const subjectDomains = domains && domains.length ? domains.filter((d) => DOMAINS[subject].includes(d)) : [];
    const domainList = subjectDomains.length ? subjectDomains : [null];
    const remaining = count - picked.length;
    if (remaining <= 0) break;
    const wantThisSubject = Math.min(perSubject, remaining);
    const perDomain = Math.ceil(wantThisSubject / domainList.length);
    for (const domain of domainList) {
      const still = count - picked.length;
      if (still <= 0) break;
      const filters = buildFilters({ subject, domain, difficulties });
      const qs = await fetchRandom(filters, Math.min(perDomain, still), excluded);
      qs.forEach((q) => excluded.add(q.id));
      picked.push(...qs);
    }
  }

  // Top up if per-domain caps left us short (small bank, or uneven
  // domain availability) — relax to a subject-only filter for the rest.
  if (picked.length < count) {
    for (const subject of subjects) {
      const still = count - picked.length;
      if (still <= 0) break;
      const filters = buildFilters({ subject, difficulties });
      const qs = await fetchRandom(filters, still, excluded);
      qs.forEach((q) => excluded.add(q.id));
      picked.push(...qs);
    }
  }

  return shuffle(picked).slice(0, count);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build one official-length, domain-weighted module for a subject. */
export async function buildModule(subject, { difficulties, excludeIds } = {}) {
  const { questionsPerModule, minutesPerModule } = MODULE_STRUCTURE[subject];
  const questions = await weightedSetForSubject(subject, questionsPerModule, { difficulties, excludeIds });
  return { subject, minutes: minutesPerModule, questions };
}

/** Build both modules of one section (Reading & Writing, or Math). */
export async function buildSection(subject, { difficulties } = {}) {
  const { modulesPerSection } = MODULE_STRUCTURE[subject];
  const modules = [];
  const excludeIds = new Set();
  for (let i = 0; i < modulesPerSection; i++) {
    const mod = await buildModule(subject, { difficulties, excludeIds });
    mod.questions.forEach((q) => excludeIds.add(q.id));
    mod.name = `${subject === "rw" ? "Reading & Writing" : "Math"} — Module ${i + 1}`;
    modules.push(mod);
  }
  return modules;
}

/** Build a full practice test: R&W section then Math section. */
export async function buildFullTest({ difficulties } = {}) {
  const rw = await buildSection("rw", { difficulties });
  const math = await buildSection("math", { difficulties });
  return [...rw, ...math];
}

/** 10-question quick practice set, untimed by default. */
export async function buildQuick10({ subjects, domains, difficulties } = {}) {
  const subs = subjects && subjects.length ? subjects : ["rw", "math"];
  const questions = await customSet({ subjects: subs, domains, difficulties, count: 10 });
  return [{ subject: subs.length === 1 ? subs[0] : "both", minutes: null, questions, name: "Quick 10" }];
}

export async function getQuestionsByIds(ids) {
  if (ids.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const out = [];
  for (const chunk of chunks) {
    const q = query(collection(db, QUESTIONS), where(documentId(), "in", chunk));
    const snap = await getDocs(q);
    out.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  return out;
}
