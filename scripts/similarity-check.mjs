import { breedByName, personas, questions } from "../lib/content";
import { buildLocalReport } from "../lib/local-report";
import { collectPremiumFlags } from "../lib/premium";
import { reportSentenceSimilarity } from "../lib/report-similarity";
import { detectBreedConflict, scoreAnswers } from "../lib/scoring";
import { randomUUID } from "node:crypto";

const ANSWERS = [
  [0, 3, 0, 1, 1, 1, 2, 1, 0, 0, 3, 1, 3, 3, 2, 3],
  [2, 3, 0, 3, 0, 2, 2, 2, 0, 0, 3, 3, 1, 3, 2, 3],
];
const PREMIUM_ANSWERS = [
  [1, 1, 1, 1, 0, 0, 1],
  [2, 0, 2, 0, 0, 1, 2],
];
const PAIRS = 10;
const MEAN_LIMIT = 0.35;
const MAX_LIMIT = 0.42;

function createReport(sessionId, answers, premiumAnswers) {
  const score = scoreAnswers(answers);
  const persona = personas.find((item) => item.id === score.personaId);
  if (!persona) throw new Error(`找不到人格: ${score.personaId}`);
  const report = buildLocalReport({
    sessionId,
    persona,
    answersSummary: answers.map((optionIndex, index) => (
      `${questions[index].text} → ${questions[index].options[optionIndex].text}`
    )),
    hardFlags: score.hardFlags,
    premiumFlags: collectPremiumFlags(premiumAnswers),
    breedFacts: breedByName(persona.primaryBreed.name),
    conflict: detectBreedConflict(persona, score.hardFlags),
  });
  return { report, persona };
}

const ratios = [];
const repeatCounter = new Map();
for (let i = 0; i < PAIRS; i += 1) {
  const a = createReport(randomUUID(), ANSWERS[0], PREMIUM_ANSWERS[0]);
  const b = createReport(randomUUID(), ANSWERS[1], PREMIUM_ANSWERS[1]);
  if (a.persona.id !== "dusk_weaver" || b.persona.id !== "dusk_weaver") {
    throw new Error(`F1 人格偏移: ${a.persona.id}, ${b.persona.id}`);
  }
  const result = reportSentenceSimilarity(a.report, b.report, {
    reasonableRepeatLines: [a.persona.signatureParagraph, a.persona.primaryBreed.reason],
    reasonableRepeatPrefixes: a.persona.altBreeds.map((item) => `${item.name}：`),
  });
  ratios.push(result.variableRatio);
  for (const sentence of result.variableDuplicates) {
    repeatCounter.set(sentence, (repeatCounter.get(sentence) ?? 0) + 1);
  }
}

const mean = ratios.reduce((sum, x) => sum + x, 0) / ratios.length;
const max = Math.max(...ratios);
console.log(`各对验收重复率: ${ratios.map((x) => `${(x * 100).toFixed(0)}%`).join(" ")}`);
console.log(`均值 ${(mean * 100).toFixed(1)}%(阈值 ≤${MEAN_LIMIT * 100}%) 最差 ${(max * 100).toFixed(1)}%(阈值 ≤${MAX_LIMIT * 100}%)`);
console.log("撞车榜(跨10对重复次数最多的叙述句):");
const board = [...repeatCounter.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10);
for (const [sentence, count] of board) {
  console.log(`  ${count}次 | ${sentence}`);
}
if (mean > MEAN_LIMIT || max > MAX_LIMIT) {
  console.error("未达标:请按撞车榜定位仍在重复的句位");
  process.exitCode = 1;
}
