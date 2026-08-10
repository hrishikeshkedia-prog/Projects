// Runs one practice-test session: navigation, answer tracking, per-module
// timing, and scoring. State is persisted to localStorage so an accidental
// reload doesn't lose progress mid-test.

const STORAGE_KEY = "sat_active_session";

export class TestSession {
  constructor(data) {
    Object.assign(
      this,
      {
        id: crypto.randomUUID(),
        mode: "custom",
        timed: true,
        modules: [],
        moduleIndex: 0,
        questionIndex: 0,
        answers: {}, // questionId -> { selected, flagged, timeSpentSec }
        secondsRemaining: null,
        startedAt: Date.now(),
        submittedAt: null
      },
      data
    );
    this._tickHandle = null;
  }

  static restore() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return new TestSession(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this));
  }

  static clearSaved() {
    localStorage.removeItem(STORAGE_KEY);
  }

  get module() {
    return this.modules[this.moduleIndex];
  }

  get question() {
    return this.module.questions[this.questionIndex];
  }

  get totalQuestions() {
    return this.modules.reduce((sum, m) => sum + m.questions.length, 0);
  }

  get answeredCount() {
    return Object.values(this.answers).filter((a) => a.selected).length;
  }

  startModuleTimer(onTick, onTimeUp) {
    this.stopTimer();
    if (!this.timed || this.module.minutes == null) return;
    if (this.secondsRemaining == null) this.secondsRemaining = this.module.minutes * 60;
    this._tickHandle = setInterval(() => {
      this.secondsRemaining -= 1;
      this.save();
      onTick?.(this.secondsRemaining);
      if (this.secondsRemaining <= 0) {
        this.stopTimer();
        onTimeUp?.();
      }
    }, 1000);
  }

  stopTimer() {
    if (this._tickHandle) clearInterval(this._tickHandle);
    this._tickHandle = null;
  }

  selectAnswer(key) {
    const q = this.question;
    const entry = this.answers[q.id] || { selected: null, flagged: false, timeSpentSec: 0 };
    entry.selected = key;
    this.answers[q.id] = entry;
    this.save();
  }

  toggleFlag() {
    const q = this.question;
    const entry = this.answers[q.id] || { selected: null, flagged: false, timeSpentSec: 0 };
    entry.flagged = !entry.flagged;
    this.answers[q.id] = entry;
    this.save();
  }

  goTo(index) {
    if (index < 0 || index >= this.module.questions.length) return;
    this.questionIndex = index;
    this.save();
  }

  next() {
    this.goTo(this.questionIndex + 1);
  }

  prev() {
    this.goTo(this.questionIndex - 1);
  }

  hasNextModule() {
    return this.moduleIndex < this.modules.length - 1;
  }

  advanceModule() {
    this.stopTimer();
    this.moduleIndex += 1;
    this.questionIndex = 0;
    this.secondsRemaining = null;
    this.save();
  }

  finish() {
    this.stopTimer();
    this.submittedAt = Date.now();
    this.save();
    return this.score();
  }

  score() {
    let correct = 0;
    let total = 0;
    const byDomain = {};
    const bySkill = {};

    for (const mod of this.modules) {
      for (const q of mod.questions) {
        total += 1;
        const entry = this.answers[q.id];
        const isCorrect = !!entry && entry.selected === q.answer;
        if (isCorrect) correct += 1;

        const dKey = `${q.subject}:${q.domain}`;
        byDomain[dKey] = byDomain[dKey] || { label: q.domain, subject: q.subject, correct: 0, total: 0 };
        byDomain[dKey].total += 1;
        if (isCorrect) byDomain[dKey].correct += 1;

        bySkill[q.skill] = bySkill[q.skill] || { label: q.skill, correct: 0, total: 0 };
        bySkill[q.skill].total += 1;
        if (isCorrect) bySkill[q.skill].correct += 1;
      }
    }

    return {
      correct,
      total,
      percent: total ? Math.round((correct / total) * 100) : 0,
      byDomain: Object.values(byDomain),
      bySkill: Object.values(bySkill)
    };
  }
}
