import { breedByName, personas, questions } from "../lib/content";
import { buildLocalReport } from "../lib/local-report";
import { collectPremiumFlags } from "../lib/premium";
import { reportSentenceSimilarity } from "../lib/report-similarity";
import { detectBreedConflict, scoreAnswers } from "../lib/scoring";

const ANSWERS = [
  [0, 3, 0, 1, 1, 1, 2, 1, 0, 0, 3, 1, 3, 3, 2, 3],
  [2, 3, 0, 3, 0, 2, 2, 2, 0, 0, 3, 3, 1, 3, 2, 3],
];

const PREMIUM_ANSWERS = [
  [0, 0, 1, 2, 0, 1, 0],
  [3, 3, 3, 1, 0, 4, 4],
];

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

const SESSION_IDS = [
  "c0b66202-3383-4f3d-86a5-ce0fe22625be",
  "5b92f84a-4344-465d-a12d-04bffdae452c",
];
const reports = ANSWERS.map((answers, index) => createReport(SESSION_IDS[index], answers, PREMIUM_ANSWERS[index]));
if (reports.some(({ persona }) => persona.id !== "dusk_weaver")) {
  throw new Error(`F1 人格偏移: ${reports.map(({ persona }) => persona.id).join(", ")}`);
}
const persona = reports[0].persona;
const result = reportSentenceSimilarity(reports[0].report, reports[1].report, {
  reasonableRepeatLines: [persona.signatureParagraph, persona.primaryBreed.reason],
  reasonableRepeatPrefixes: persona.altBreeds.map((item) => `${item.name}：`),
});

console.log(`报告1总句数: ${result.totalSentenceCount}`);
console.log(`原始完全相同句数: ${result.rawDuplicateCount}`);
console.log(`原始完全相同句子占比: ${(result.rawRatio * 100).toFixed(1)}%`);
console.log(`剔除签名段与事实数据行后的叙述句数: ${result.variableSentenceCount}`);
console.log(`叙述句完全相同句数: ${result.variableDuplicateCount}`);
console.log(`验收重复率: ${(result.variableRatio * 100).toFixed(1)}%`);
console.log("重复叙述句:");
for (const sentence of result.variableDuplicates) console.log(`- ${sentence}`);

if (result.variableRatio > 0.35) process.exitCode = 1;
