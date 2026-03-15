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
  xFrac: number;
  parentIds: string[];
  defaultChallenges: Challenge[];
};

export type TreeLevel = {
  number: number;
  title: string;
  subtitle: string;
  color: string;
};

type ChallengeSeed = {
  title: string;
  detail: string;
};

type NodeSeed = Omit<SkillNode, "defaultChallenges"> & {
  xp: number;
  challenges: [ChallengeSeed, ChallengeSeed, ChallengeSeed];
};

function makeChallenges(nodeId: string, xp: number, seeds: [ChallengeSeed, ChallengeSeed, ChallengeSeed]): Challenge[] {
  return seeds.map((seed, index) => ({
    id: `${nodeId}-c${index + 1}`,
    nodeId,
    title: seed.title,
    detail: seed.detail,
    xp,
  }));
}

function createNode(seed: NodeSeed): SkillNode {
  return {
    id: seed.id,
    levelNumber: seed.levelNumber,
    domainId: seed.domainId,
    title: seed.title,
    description: seed.description,
    icon: seed.icon,
    goalPrompt: seed.goalPrompt,
    xFrac: seed.xFrac,
    parentIds: seed.parentIds,
    defaultChallenges: makeChallenges(seed.id, seed.xp, seed.challenges),
  };
}

export const DOMAIN_COLOR: Record<DomainId, string> = {
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
  { number: 1, title: "Foundation", subtitle: "Awaken your base", color: "#3DFF8E" },
  { number: 2, title: "Discipline", subtitle: "Turn intent into rhythm", color: "#5DE1FF" },
  { number: 3, title: "Expansion", subtitle: "Widen your capability", color: "#64B5FF" },
  { number: 4, title: "Specialization", subtitle: "Shape your build", color: "#7C9BFF" },
  { number: 5, title: "Momentum", subtitle: "Compound the gains", color: "#A78BFA" },
  { number: 6, title: "Ascension", subtitle: "Operate with intent", color: "#FF8AE2" },
  { number: 7, title: "Transcendence", subtitle: "Reach your upper form", color: "#FFD700" },
];

export const SKILL_NODES: SkillNode[] = [
  createNode({
    id: "calm",
    levelNumber: 1,
    domainId: "mind",
    title: "Calm",
    description: "Quiet your inner noise so focus and self-command have something stable to stand on.",
    icon: "Wind",
    goalPrompt: "e.g. I want to feel less reactive and more emotionally steady",
    xFrac: 0.18,
    parentIds: [],
    xp: 30,
    challenges: [
      { title: "Breath reset", detail: "2 minutes of box breathing" },
      { title: "Silent minute", detail: "Sit without input for 60 seconds" },
      { title: "Soft landing", detail: "Pause before your next reaction" },
    ],
  }),
  createNode({
    id: "vitality",
    levelNumber: 1,
    domainId: "body",
    title: "Vitality",
    description: "Rebuild your baseline energy with sleep, hydration, and movement that make the rest possible.",
    icon: "Heart",
    goalPrompt: "e.g. I want steady energy and healthier daily habits",
    xFrac: 0.5,
    parentIds: [],
    xp: 30,
    challenges: [
      { title: "Hydrate early", detail: "Drink 2 glasses after waking" },
      { title: "Body wake-up", detail: "5-minute stretch sequence" },
      { title: "Sleep setup", detail: "No screens 30 minutes before bed" },
    ],
  }),
  createNode({
    id: "spark",
    levelNumber: 1,
    domainId: "craft",
    title: "Spark",
    description: "Start your craft before you feel ready. Progress begins when you show up anyway.",
    icon: "Sparkles",
    goalPrompt: "e.g. I want to build a skill I can be proud of",
    xFrac: 0.82,
    parentIds: [],
    xp: 30,
    challenges: [
      { title: "Tiny session", detail: "Practice your craft for 15 minutes" },
      { title: "Learn a piece", detail: "Study one concept deeply" },
      { title: "Make a draft", detail: "Create something rough and real" },
    ],
  }),
  createNode({
    id: "focus",
    levelNumber: 2,
    domainId: "mind",
    title: "Focus",
    description: "Aim your attention like a weapon. This branch turns scattered effort into clean execution.",
    icon: "Eye",
    goalPrompt: "e.g. I want deeper concentration and fewer distractions",
    xFrac: 0.1,
    parentIds: ["calm"],
    xp: 40,
    challenges: [
      { title: "One target", detail: "Choose one high-value task" },
      { title: "Deep sprint", detail: "Work 25 minutes phone-free" },
      { title: "Tab cleanse", detail: "Close visual distractions first" },
    ],
  }),
  createNode({
    id: "reflection",
    levelNumber: 2,
    domainId: "mind",
    title: "Reflection",
    description: "Learn to see your own patterns. Reflection turns experience into useful wisdom.",
    icon: "Lightbulb",
    goalPrompt: "e.g. I want to notice patterns and make better decisions",
    xFrac: 0.34,
    parentIds: ["calm"],
    xp: 40,
    challenges: [
      { title: "Night review", detail: "Journal 3 lines on today" },
      { title: "Trigger map", detail: "Write one emotional trigger" },
      { title: "Lesson pulled", detail: "Name one lesson from a mistake" },
    ],
  }),
  createNode({
    id: "energy",
    levelNumber: 2,
    domainId: "body",
    title: "Energy",
    description: "Stabilize your fuel so your body can support ambition instead of fighting it.",
    icon: "Zap",
    goalPrompt: "e.g. I want strong daily energy and fewer crashes",
    xFrac: 0.66,
    parentIds: ["vitality"],
    xp: 40,
    challenges: [
      { title: "Protein start", detail: "Eat a protein-first meal" },
      { title: "Sun hit", detail: "Get 10 minutes of daylight" },
      { title: "Walk break", detail: "Take a 10-minute energy walk" },
    ],
  }),
  createNode({
    id: "build",
    levelNumber: 2,
    domainId: "craft",
    title: "Build",
    description: "Move from intention to output. This is the branch where ideas become artifacts.",
    icon: "Hammer",
    goalPrompt: "e.g. I want to actually ship instead of just planning",
    xFrac: 0.9,
    parentIds: ["spark"],
    xp: 40,
    challenges: [
      { title: "Ship a piece", detail: "Publish one small deliverable" },
      { title: "Tool reps", detail: "Practice your core tool for 20 minutes" },
      { title: "Visible progress", detail: "Share a work-in-progress update" },
    ],
  }),
  createNode({
    id: "learning",
    levelNumber: 3,
    domainId: "mind",
    title: "Learning",
    description: "Upgrade how you absorb, retain, and revisit knowledge so it sticks under pressure.",
    icon: "Star",
    goalPrompt: "e.g. I want to learn faster and remember more",
    xFrac: 0.12,
    parentIds: ["focus"],
    xp: 50,
    challenges: [
      { title: "Study block", detail: "Read or watch for 30 focused minutes" },
      { title: "Recall test", detail: "Summarize from memory" },
      { title: "Teach back", detail: "Explain one concept out loud" },
    ],
  }),
  createNode({
    id: "strength",
    levelNumber: 3,
    domainId: "body",
    title: "Strength",
    description: "Build raw capacity through progressive challenge and repeatable training.",
    icon: "Flame",
    goalPrompt: "e.g. I want to get stronger and feel powerful",
    xFrac: 0.38,
    parentIds: ["energy"],
    xp: 50,
    challenges: [
      { title: "Main lift", detail: "Complete one strength session" },
      { title: "Rep gain", detail: "Add 1 rep over last time" },
      { title: "Post-workout fuel", detail: "Eat a recovery meal" },
    ],
  }),
  createNode({
    id: "coding",
    levelNumber: 3,
    domainId: "craft",
    title: "Coding",
    description: "Train precise problem-solving and structured creation through technical craft.",
    icon: "Zap",
    goalPrompt: "e.g. I want to become sharper at building with code",
    xFrac: 0.62,
    parentIds: ["build"],
    xp: 50,
    challenges: [
      { title: "Code block", detail: "Build for 30 minutes uninterrupted" },
      { title: "Bug hunt", detail: "Fix one real issue" },
      { title: "Refactor pass", detail: "Improve one rough section" },
    ],
  }),
  createNode({
    id: "recovery",
    levelNumber: 3,
    domainId: "body",
    title: "Recovery",
    description: "Learn to repair well so training and work actually compound instead of draining you.",
    icon: "Wind",
    goalPrompt: "e.g. I want to bounce back faster and avoid burnout",
    xFrac: 0.88,
    parentIds: ["energy"],
    xp: 50,
    challenges: [
      { title: "Cooldown", detail: "Spend 8 minutes downshifting" },
      { title: "Tension release", detail: "Do mobility or foam rolling" },
      { title: "Sleep protect", detail: "Guard your bedtime window" },
    ],
  }),
  createNode({
    id: "discipline",
    levelNumber: 4,
    domainId: "mind",
    title: "Discipline",
    description: "Hold your line even when motivation disappears. Discipline keeps the build alive.",
    icon: "Award",
    goalPrompt: "e.g. I want consistency even on low-motivation days",
    xFrac: 0.1,
    parentIds: ["learning", "reflection"],
    xp: 60,
    challenges: [
      { title: "Hard first", detail: "Do the hardest task before noon" },
      { title: "No zero day", detail: "Advance one goal no matter what" },
      { title: "Rule kept", detail: "Honor one promise to yourself" },
    ],
  }),
  createNode({
    id: "endurance",
    levelNumber: 4,
    domainId: "body",
    title: "Endurance",
    description: "Extend your capacity to keep going when effort gets uncomfortable.",
    icon: "Activity",
    goalPrompt: "e.g. I want more stamina and better conditioning",
    xFrac: 0.36,
    parentIds: ["strength", "recovery"],
    xp: 60,
    challenges: [
      { title: "Zone two", detail: "Cardio for 25 steady minutes" },
      { title: "Distance up", detail: "Push your previous benchmark" },
      { title: "Finish strong", detail: "Complete the full planned session" },
    ],
  }),
  createNode({
    id: "making",
    levelNumber: 4,
    domainId: "craft",
    title: "Making",
    description: "Develop taste through repetition. Makers grow by producing volume with intention.",
    icon: "Hammer",
    goalPrompt: "e.g. I want to make more real things every week",
    xFrac: 0.64,
    parentIds: ["coding", "build"],
    xp: 60,
    challenges: [
      { title: "Prototype", detail: "Build one rough version today" },
      { title: "Constraint mode", detail: "Create with a strict time limit" },
      { title: "Finish loop", detail: "Take one draft to done" },
    ],
  }),
  createNode({
    id: "memory",
    levelNumber: 4,
    domainId: "mind",
    title: "Memory",
    description: "Strengthen recall so what you learn stays usable and accessible.",
    icon: "Eye",
    goalPrompt: "e.g. I want better recall for books, work, and learning",
    xFrac: 0.9,
    parentIds: ["learning", "reflection"],
    xp: 60,
    challenges: [
      { title: "Flash recall", detail: "Review 10 key facts from memory" },
      { title: "Mental map", detail: "Sketch one concept from memory" },
      { title: "Review loop", detail: "Revisit yesterday's main idea" },
    ],
  }),
  createNode({
    id: "creativity",
    levelNumber: 5,
    domainId: "mind",
    title: "Creativity",
    description: "Generate novel ideas by combining pattern recognition with fearless experimentation.",
    icon: "Sparkles",
    goalPrompt: "e.g. I want more original ideas and better creative flow",
    xFrac: 0.12,
    parentIds: ["memory", "reflection"],
    xp: 70,
    challenges: [
      { title: "Idea storm", detail: "Write 10 fast ideas" },
      { title: "Remix", detail: "Combine two unrelated concepts" },
      { title: "Creative risk", detail: "Make one bold choice in your work" },
    ],
  }),
  createNode({
    id: "mobility",
    levelNumber: 5,
    domainId: "body",
    title: "Mobility",
    description: "Move with range and control so your body feels powerful, fluid, and durable.",
    icon: "Wind",
    goalPrompt: "e.g. I want fewer aches and better movement quality",
    xFrac: 0.38,
    parentIds: ["recovery", "strength"],
    xp: 70,
    challenges: [
      { title: "Joint prep", detail: "Do 10 minutes of mobility work" },
      { title: "Deep range", detail: "Hold end-range positions with control" },
      { title: "Move clean", detail: "Practice quality movement patterns" },
    ],
  }),
  createNode({
    id: "output",
    levelNumber: 5,
    domainId: "craft",
    title: "Output",
    description: "Increase your shipping rate. This branch rewards volume, clarity, and finishing.",
    icon: "Rocket",
    goalPrompt: "e.g. I want to publish more consistently and finish faster",
    xFrac: 0.62,
    parentIds: ["making", "coding"],
    xp: 70,
    challenges: [
      { title: "Ship day", detail: "Release something publicly" },
      { title: "Done list", detail: "Close one lingering task" },
      { title: "Publish note", detail: "Share a lesson or update" },
    ],
  }),
  createNode({
    id: "nutrition",
    levelNumber: 5,
    domainId: "body",
    title: "Nutrition",
    description: "Turn food into leverage. Better nutrition sharpens training, recovery, and cognition.",
    icon: "Heart",
    goalPrompt: "e.g. I want my nutrition to support my goals consistently",
    xFrac: 0.88,
    parentIds: ["endurance", "recovery"],
    xp: 70,
    challenges: [
      { title: "Fuel plan", detail: "Pre-plan your meals for the day" },
      { title: "Whole plate", detail: "Eat one clean balanced meal" },
      { title: "Sugar control", detail: "Skip one unnecessary processed snack" },
    ],
  }),
  createNode({
    id: "insight",
    levelNumber: 6,
    domainId: "mind",
    title: "Insight",
    description: "See second-order patterns and make sharper judgments with less noise.",
    icon: "Lightbulb",
    goalPrompt: "e.g. I want better strategic thinking and better decisions",
    xFrac: 0.1,
    parentIds: ["creativity", "discipline", "memory"],
    xp: 85,
    challenges: [
      { title: "Pattern note", detail: "Write one recurring pattern you noticed" },
      { title: "Decision audit", detail: "Review one choice before acting" },
      { title: "Long-view", detail: "Think two steps ahead on a problem" },
    ],
  }),
  createNode({
    id: "sleep",
    levelNumber: 6,
    domainId: "body",
    title: "Sleep",
    description: "Treat sleep like a performance system, not an afterthought.",
    icon: "MoonStar",
    goalPrompt: "e.g. I want deeper sleep and stronger recovery",
    xFrac: 0.36,
    parentIds: ["nutrition", "mobility"],
    xp: 85,
    challenges: [
      { title: "Dark room", detail: "Optimize your room before bed" },
      { title: "Same bedtime", detail: "Keep a consistent sleep window" },
      { title: "Caffeine cutoff", detail: "Stop caffeine early today" },
    ],
  }),
  createNode({
    id: "career",
    levelNumber: 6,
    domainId: "craft",
    title: "Career",
    description: "Aim your craft at real leverage, reputation, and opportunity.",
    icon: "Briefcase",
    goalPrompt: "e.g. I want my skills to create meaningful career momentum",
    xFrac: 0.64,
    parentIds: ["output", "making"],
    xp: 85,
    challenges: [
      { title: "Portfolio move", detail: "Improve one proof-of-work asset" },
      { title: "Network ping", detail: "Reach out to one valuable contact" },
      { title: "Career rep", detail: "Do one task that compounds reputation" },
    ],
  }),
  createNode({
    id: "expression",
    levelNumber: 6,
    domainId: "craft",
    title: "Expression",
    description: "Develop a signature voice so your work feels unmistakably yours.",
    icon: "PenTool",
    goalPrompt: "e.g. I want my work to feel more distinct and alive",
    xFrac: 0.9,
    parentIds: ["creativity", "output"],
    xp: 85,
    challenges: [
      { title: "Signature choice", detail: "Make one stylistic choice on purpose" },
      { title: "Voice draft", detail: "Create in your own tone" },
      { title: "Style study", detail: "Analyze a creator you admire" },
    ],
  }),
  createNode({
    id: "flow",
    levelNumber: 7,
    domainId: "mind",
    title: "Flow",
    description: "Enter high-focus states on demand through environment, rhythm, and self-command.",
    icon: "Zap",
    goalPrompt: "e.g. I want to trigger deep flow in work and life",
    xFrac: 0.14,
    parentIds: ["insight", "discipline"],
    xp: 100,
    challenges: [
      { title: "Flow gate", detail: "Create a 60-minute distraction-free window" },
      { title: "Peak block", detail: "Work at your highest-energy time" },
      { title: "Exit ritual", detail: "Close the session with a reset" },
    ],
  }),
  createNode({
    id: "peak",
    levelNumber: 7,
    domainId: "body",
    title: "Peak",
    description: "Express your body at a high level with power, stamina, recovery, and control aligned.",
    icon: "Trophy",
    goalPrompt: "e.g. I want to perform like an athlete in daily life",
    xFrac: 0.4,
    parentIds: ["sleep", "mobility", "endurance"],
    xp: 100,
    challenges: [
      { title: "Benchmark", detail: "Test one key performance metric" },
      { title: "Full session", detail: "Execute a complete training day" },
      { title: "Recover hard", detail: "Nail recovery after effort" },
    ],
  }),
  createNode({
    id: "mastery",
    levelNumber: 7,
    domainId: "craft",
    title: "Mastery",
    description: "Perform with consistency, taste, and command even when the stakes are high.",
    icon: "Award",
    goalPrompt: "e.g. I want to reach a level of serious craft confidence",
    xFrac: 0.66,
    parentIds: ["career", "expression"],
    xp: 100,
    challenges: [
      { title: "Refine edge", detail: "Polish one important piece of work" },
      { title: "Teach the path", detail: "Explain your process to someone" },
      { title: "Raise standard", detail: "Upgrade one quality benchmark" },
    ],
  }),
  createNode({
    id: "legacy",
    levelNumber: 7,
    domainId: "craft",
    title: "Legacy",
    description: "Build work that outlives the session and shapes people beyond your immediate circle.",
    icon: "Star",
    goalPrompt: "e.g. I want to create work that matters long-term",
    xFrac: 0.88,
    parentIds: ["mastery", "career", "expression"],
    xp: 100,
    challenges: [
      { title: "Long-game piece", detail: "Work on something designed to last" },
      { title: "Document value", detail: "Capture a principle others can use" },
      { title: "Mentor move", detail: "Help someone level up with your craft" },
    ],
  }),
];

export const NODE_COMPLETION_XP: Record<number, number> = {
  1: 100,
  2: 140,
  3: 180,
  4: 240,
  5: 300,
  6: 380,
  7: 500,
};

export const LEVEL_COMPLETION_XP: Record<number, number> = {
  1: 300,
  2: 420,
  3: 560,
  4: 740,
  5: 920,
  6: 1180,
  7: 1500,
};

export const USER_LEVEL_THRESHOLDS = [0, 400, 900, 1500, 2200, 3000, 3900, 4900, 6100, 7400, 8800, 10300, 11900, 13600, 15400, 17300];

export const PRESTIGE_RANKS = [
  { name: "Apprentice", color: "#9AA3C7", minPrestige: 0 },
  { name: "Seeker", color: "#3DFF8E", minPrestige: 1 },
  { name: "Forger", color: "#5DE1FF", minPrestige: 2 },
  { name: "Ascendant", color: "#A78BFA", minPrestige: 3 },
  { name: "Vanguard", color: "#FF8AE2", minPrestige: 4 },
  { name: "Legend", color: "#FFD700", minPrestige: 5 },
  { name: "Mythic", color: "#FF9A4D", minPrestige: 7 },
  { name: "Paragon", color: "#7CFFDA", minPrestige: 9 },
  { name: "Eternal", color: "#B6C4FF", minPrestige: 12 },
  { name: "Cosmic", color: "#FFFFFF", minPrestige: 15 },
] as const;

export function getUserLevel(xp: number): number {
  for (let i = USER_LEVEL_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (xp >= USER_LEVEL_THRESHOLDS[i]) {
      return i + 1;
    }
  }
  return 1;
}

export function getXpForNextLevel(userLevel: number): number {
  return USER_LEVEL_THRESHOLDS[userLevel] ?? USER_LEVEL_THRESHOLDS[USER_LEVEL_THRESHOLDS.length - 1] ?? 0;
}

export function getXpForCurrentLevel(userLevel: number): number {
  return USER_LEVEL_THRESHOLDS[userLevel - 1] ?? 0;
}

export function getPrestigeRank(prestigeCount: number) {
  for (let i = PRESTIGE_RANKS.length - 1; i >= 0; i -= 1) {
    if (prestigeCount >= PRESTIGE_RANKS[i].minPrestige) {
      return PRESTIGE_RANKS[i];
    }
  }
  return PRESTIGE_RANKS[0];
}

export function getPrestigeXpMultiplier(prestigeCount: number): number {
  const bonusSteps = Math.min(prestigeCount, 10);
  return 1 + bonusSteps * 0.05;
}

export function getPrestigeBonusLabel(prestigeCount: number): string {
  const multiplier = getPrestigeXpMultiplier(prestigeCount);
  return `${Math.round((multiplier - 1) * 100)}% permanent XP bonus`;
}

export function getNodesForLevel(levelNumber: number): SkillNode[] {
  return SKILL_NODES.filter((node) => node.levelNumber === levelNumber);
}