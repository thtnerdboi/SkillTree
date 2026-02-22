export type DomainId = "mind" | "body" | "craft";

export type Challenge = {
  id: string;
  nodeId: string;
  title: string;
  detail: string;
  xp: number;
};

export type SkillNode = {
  id: string;
  levelNumber: number;
  domainId: DomainId;
  title: string;
  description: string;
  icon: string;
  goalPrompt: string;
  defaultChallenges: Challenge[];
};

export type TreeLevel = {
  number: number;
  title: string;
  subtitle: string;
  color: string;
};

export const DOMAIN_COLOR: Record<string, string> = {
  mind: "#64B5FF",
  body: "#FF6A4D",
  craft: "#A78BFA",
};

export const DOMAIN_LABEL: Record<DomainId, string> = {
  mind: "Mind",
  body: "Body",
  craft: "Craft",
};

export const TREE_LEVELS: TreeLevel[] = [
  { number: 1, title: "Foundation", subtitle: "Begin the journey", color: "#3DFF8E" },
  { number: 2, title: "Momentum", subtitle: "Build consistency", color: "#5DE1FF" },
  { number: 3, title: "Awakening", subtitle: "Expand your capacity", color: "#64B5FF" },
  { number: 4, title: "Apex", subtitle: "Reach your potential", color: "#FFD700" },
];

export const SKILL_NODES: SkillNode[] = [
  // ── LEVEL 1 ─────────────────────────────────────────────────────
  {
    id: "vitality",
    levelNumber: 1,
    domainId: "body",
    title: "Vitality",
    description: "Build your physical baseline. A healthy body is the foundation for everything else — energy, resilience, and longevity begin here.",
    icon: "Heart",
    goalPrompt: "e.g. I want to lose 10kg and feel energized every morning",
    defaultChallenges: [
      { id: "vitality-c1", nodeId: "vitality", title: "Morning hydration", detail: "2 large glasses of water", xp: 30 },
      { id: "vitality-c2", nodeId: "vitality", title: "Body scan", detail: "5-min stretch routine", xp: 30 },
      { id: "vitality-c3", nodeId: "vitality", title: "Sleep prep", detail: "No screens 30 min before bed", xp: 30 },
    ],
  },
  {
    id: "stillness",
    levelNumber: 1,
    domainId: "mind",
    title: "Calm",
    description: "Cultivate a baseline of mental calm. A still mind responds rather than reacts — it's where all clarity begins.",
    icon: "Wind",
    goalPrompt: "e.g. I want to stop feeling anxious and overwhelmed at work",
    defaultChallenges: [
      { id: "stillness-c1", nodeId: "stillness", title: "Breath reset", detail: "2-min box breathing", xp: 30 },
      { id: "stillness-c2", nodeId: "stillness", title: "Gratitude note", detail: "Write 1 sentence", xp: 30 },
      { id: "stillness-c3", nodeId: "stillness", title: "Digital detox", detail: "15-min no-phone window", xp: 30 },
    ],
  },
  {
    id: "spark",
    levelNumber: 1,
    domainId: "craft",
    title: "Spark",
    description: "Ignite your creative practice. Every master started by showing up before they felt ready. The spark is that first act of commitment.",
    icon: "Sparkles",
    goalPrompt: "e.g. I want to learn to code / play guitar / build a business",
    defaultChallenges: [
      { id: "spark-c1", nodeId: "spark", title: "Skill practice", detail: "15 min deliberate practice", xp: 30 },
      { id: "spark-c2", nodeId: "spark", title: "Tiny creation", detail: "Make something, no matter how small", xp: 30 },
      { id: "spark-c3", nodeId: "spark", title: "Learn one thing", detail: "Study a concept for 20 min", xp: 30 },
    ],
  },

  // ── LEVEL 2 ─────────────────────────────────────────────────────
  {
    id: "motion",
    levelNumber: 2,
    domainId: "body",
    title: "Motion",
    description: "Make movement a daily ritual. Consistent physical activity resets your nervous system, sharpens cognition, and compounds over time.",
    icon: "Activity",
    goalPrompt: "e.g. I want to build a daily workout habit and run 5km",
    defaultChallenges: [
      { id: "motion-c1", nodeId: "motion", title: "Daily walk", detail: "20 minutes minimum", xp: 40 },
      { id: "motion-c2", nodeId: "motion", title: "Mobility drill", detail: "10-min hip & shoulder work", xp: 40 },
      { id: "motion-c3", nodeId: "motion", title: "Step challenge", detail: "Hit 8,000 steps today", xp: 40 },
    ],
  },
  {
    id: "clarity",
    levelNumber: 2,
    domainId: "mind",
    title: "Clarity",
    description: "Cut through the noise. Clarity means knowing exactly what matters and having the discipline to pursue it without distraction.",
    icon: "Eye",
    goalPrompt: "e.g. I want to focus for 2 hours daily without distraction",
    defaultChallenges: [
      { id: "clarity-c1", nodeId: "clarity", title: "Priority block", detail: "Pick 3 tasks, do the hardest first", xp: 40 },
      { id: "clarity-c2", nodeId: "clarity", title: "Deep work sprint", detail: "25-min phone-free focus", xp: 40 },
      { id: "clarity-c3", nodeId: "clarity", title: "End-of-day review", detail: "5-min reflection journal", xp: 40 },
    ],
  },
  {
    id: "forge",
    levelNumber: 2,
    domainId: "craft",
    title: "Forge",
    description: "Turn raw effort into refined skill. The forge is where repetition meets intention — ship imperfect work that improves with every iteration.",
    icon: "Hammer",
    goalPrompt: "e.g. I want to build and ship a project this month",
    defaultChallenges: [
      { id: "forge-c1", nodeId: "forge", title: "Ship something", detail: "Publish or share your work", xp: 40 },
      { id: "forge-c2", nodeId: "forge", title: "Deliberate reps", detail: "30-min focused skill session", xp: 40 },
      { id: "forge-c3", nodeId: "forge", title: "Get feedback", detail: "Show your work to 1 person", xp: 40 },
    ],
  },

  // ── LEVEL 3 ─────────────────────────────────────────────────────
  {
    id: "power",
    levelNumber: 3,
    domainId: "body",
    title: "Power",
    description: "Build raw physical capacity through progressive challenge. Strength compounds — each session makes the next one easier.",
    icon: "Flame",
    goalPrompt: "e.g. I want to do 50 push-ups and bench press my bodyweight",
    defaultChallenges: [
      { id: "power-c1", nodeId: "power", title: "Strength set", detail: "3×10 bodyweight exercises", xp: 50 },
      { id: "power-c2", nodeId: "power", title: "Protein goal", detail: "Hit daily protein target", xp: 50 },
      { id: "power-c3", nodeId: "power", title: "Progressive overload", detail: "Add 1 rep or set vs last time", xp: 50 },
    ],
  },
  {
    id: "insight",
    levelNumber: 3,
    domainId: "mind",
    title: "Insight",
    description: "See patterns others miss. Insight is trained through deep reading, reflection, and connecting ideas across different domains.",
    icon: "Lightbulb",
    goalPrompt: "e.g. I want to think more creatively and solve complex problems better",
    defaultChallenges: [
      { id: "insight-c1", nodeId: "insight", title: "Deep read", detail: "30 min focused reading", xp: 50 },
      { id: "insight-c2", nodeId: "insight", title: "Idea capture", detail: "Write 3 new ideas today", xp: 50 },
      { id: "insight-c3", nodeId: "insight", title: "Cross-domain link", detail: "Connect 2 unrelated concepts", xp: 50 },
    ],
  },
  {
    id: "mastery",
    levelNumber: 3,
    domainId: "craft",
    title: "Mastery",
    description: "Reach the edge of your craft. Mastery isn't perfection — it's the ability to produce excellence consistently, under any condition.",
    icon: "Award",
    goalPrompt: "e.g. I want to be recognized as an expert in my field",
    defaultChallenges: [
      { id: "mastery-c1", nodeId: "mastery", title: "Teach something", detail: "Explain a concept to someone else", xp: 50 },
      { id: "mastery-c2", nodeId: "mastery", title: "Expert output", detail: "Create your best work today", xp: 50 },
      { id: "mastery-c3", nodeId: "mastery", title: "Review & refine", detail: "Audit your craft, cut the weak parts", xp: 50 },
    ],
  },

  // ── LEVEL 4 ─────────────────────────────────────────────────────
  {
    id: "peak",
    levelNumber: 4,
    domainId: "body",
    title: "Peak",
    description: "Express your full physical potential. Peak performance is the result of consistent training, optimal recovery, and intelligent nutrition.",
    icon: "Trophy",
    goalPrompt: "e.g. I want to run a marathon / compete in a sport / feel superhuman",
    defaultChallenges: [
      { id: "peak-c1", nodeId: "peak", title: "Performance session", detail: "Full intensity workout", xp: 75 },
      { id: "peak-c2", nodeId: "peak", title: "Recovery optimize", detail: "Perfect sleep + nutrition today", xp: 75 },
      { id: "peak-c3", nodeId: "peak", title: "Peak benchmark", detail: "Test your best — track the number", xp: 75 },
    ],
  },
  {
    id: "flow",
    levelNumber: 4,
    domainId: "mind",
    title: "Flow",
    description: "Enter peak mental states regularly. Flow is the experience of effortless concentration — it can be trained and triggered on demand.",
    icon: "Zap",
    goalPrompt: "e.g. I want to reach flow state in my work and feel fully engaged",
    defaultChallenges: [
      { id: "flow-c1", nodeId: "flow", title: "Flow trigger", detail: "Remove all distractions for 45 min", xp: 75 },
      { id: "flow-c2", nodeId: "flow", title: "Peak window", detail: "Work during your best energy hours", xp: 75 },
      { id: "flow-c3", nodeId: "flow", title: "Recovery ritual", detail: "10-min wind-down after deep work", xp: 75 },
    ],
  },
  // FIX: apex node was referenced in NODE_LAYOUT in index.tsx but was missing from SKILL_NODES
  {
    id: "apex",
    levelNumber: 4,
    domainId: "craft",
    title: "Apex",
    description: "The pinnacle of your craft. Every skill, habit, and tool is now second nature — you operate at the very edge of what's possible.",
    icon: "Star",
    goalPrompt: "e.g. I want to become world-class at my craft",
    defaultChallenges: [
      { id: "apex-c1", nodeId: "apex", title: "Masterwork", detail: "Produce your single best piece of work", xp: 75 },
      { id: "apex-c2", nodeId: "apex", title: "Mentor someone", detail: "Share your expertise with a peer", xp: 75 },
      { id: "apex-c3", nodeId: "apex", title: "Raise the bar", detail: "Set a new personal record in your craft", xp: 75 },
    ],
  },
];

export const NODE_COMPLETION_XP: Record<number, number> = {
  1: 100,
  2: 150,
  3: 200,
  4: 350,
};

export const LEVEL_COMPLETION_XP: Record<number, number> = {
  1: 300,
  2: 450,
  3: 650,
  4: 1000,
};

export const USER_LEVEL_THRESHOLDS = [0, 500, 1100, 1800, 2700, 3700, 4900, 6300, 8000, 10000, 12500];

export const PRESTIGE_RANKS = [
  { name: "Apprentice", color: "#9AA3C7", minPrestige: 0 },
  { name: "Seeker", color: "#3DFF8E", minPrestige: 1 },
  { name: "Forger", color: "#5DE1FF", minPrestige: 2 },
  { name: "Ascendant", color: "#A78BFA", minPrestige: 3 },
  { name: "Legend", color: "#FFD700", minPrestige: 4 },
  { name: "Mythic", color: "#FF6A4D", minPrestige: 5 },
];

export function getUserLevel(xp: number): number {
  for (let i = USER_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= USER_LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getXpForNextLevel(userLevel: number): number {
  return USER_LEVEL_THRESHOLDS[userLevel] ?? USER_LEVEL_THRESHOLDS[USER_LEVEL_THRESHOLDS.length - 1];
}

export function getXpForCurrentLevel(userLevel: number): number {
  return USER_LEVEL_THRESHOLDS[userLevel - 1] ?? 0;
}

export function getPrestigeRank(prestigeCount: number) {
  for (let i = PRESTIGE_RANKS.length - 1; i >= 0; i--) {
    if (prestigeCount >= PRESTIGE_RANKS[i].minPrestige) return PRESTIGE_RANKS[i];
  }
  return PRESTIGE_RANKS[0];
}

export function getNodesForLevel(levelNumber: number): SkillNode[] {
  return SKILL_NODES.filter((n) => n.levelNumber === levelNumber);
}