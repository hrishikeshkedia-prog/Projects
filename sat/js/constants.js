// Shared constants describing the (Digital) SAT structure that the app
// models its test generation around.

export const SUBJECTS = {
  rw: { key: "rw", label: "Reading & Writing" },
  math: { key: "math", label: "Math" }
};

export const DOMAINS = {
  rw: [
    "Information and Ideas",
    "Craft and Structure",
    "Expression of Ideas",
    "Standard English Conventions"
  ],
  math: [
    "Algebra",
    "Advanced Math",
    "Problem-Solving and Data Analysis",
    "Geometry and Trigonometry"
  ]
};

// Approximate official domain weighting (% of questions), used to assemble
// "full test" / "full section" practice sets in realistic proportions.
export const DOMAIN_WEIGHTS = {
  rw: {
    "Information and Ideas": 0.26,
    "Craft and Structure": 0.28,
    "Expression of Ideas": 0.2,
    "Standard English Conventions": 0.26
  },
  math: {
    Algebra: 0.35,
    "Advanced Math": 0.35,
    "Problem-Solving and Data Analysis": 0.15,
    "Geometry and Trigonometry": 0.15
  }
};

// Official digital SAT module structure & timing (per module).
export const MODULE_STRUCTURE = {
  rw: { modulesPerSection: 2, questionsPerModule: 27, minutesPerModule: 32 },
  math: { modulesPerSection: 2, questionsPerModule: 22, minutesPerModule: 35 }
};

export const DIFFICULTIES = ["E", "M", "H"];
export const DIFFICULTY_LABELS = { E: "Easy", M: "Medium", H: "Hard" };

// Seconds-per-question fallback used to size the timer for custom tests
// when the student wants timing but hasn't set an explicit duration.
export const DEFAULT_PACE_SEC = { rw: 71, math: 95 };
