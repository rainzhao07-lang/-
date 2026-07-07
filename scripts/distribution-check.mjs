// 人格分布检查工具(回归用)。
// 目的:验收标准是"最高人格占比 / 最低人格占比 ≤ 2.5"。
// 16 题全枚举有数十亿组合,不现实 → 用蒙特卡洛随机抽样估计分布。
// 计分逻辑与 lib/scoring.ts 保持一致(累加 weights,平分时按 personas 顺序取先者)。
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const questions = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "questions.json"), "utf8"));
const personas = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "personas.json"), "utf8"));
const personaOrder = personas.map((p) => p.id);

const SAMPLES = Number(process.argv[2]) || 500_000;

function pickTop(scores) {
  let best = personaOrder[0];
  let bestScore = scores[best] ?? 0;
  for (const id of personaOrder) {
    const s = scores[id] ?? 0;
    if (s > bestScore) {
      best = id;
      bestScore = s;
    }
  }
  return best;
}

const counts = Object.fromEntries(personaOrder.map((id) => [id, 0]));

for (let n = 0; n < SAMPLES; n++) {
  const scores = {};
  for (const q of questions) {
    const opt = q.options[(Math.random() * q.options.length) | 0];
    for (const [pid, w] of Object.entries(opt.weights)) {
      scores[pid] = (scores[pid] ?? 0) + w;
    }
  }
  counts[pickTop(scores)]++;
}

const rows = personaOrder
  .map((id) => {
    const persona = personas.find((p) => p.id === id);
    const pct = (counts[id] / SAMPLES) * 100;
    return { id, title: persona.title, pct };
  })
  .sort((a, b) => b.pct - a.pct);

const max = rows[0].pct;
const min = rows[rows.length - 1].pct;
const ratio = max / min;

console.log(`\n蒙特卡洛抽样 ${SAMPLES.toLocaleString()} 次的人格分布:\n`);
for (const r of rows) {
  const bar = "█".repeat(Math.round(r.pct));
  console.log(`  ${r.title.padEnd(6, "　")} ${r.pct.toFixed(2).padStart(6)}%  ${bar}`);
}
console.log(`\n最高 ${max.toFixed(2)}% / 最低 ${min.toFixed(2)}% = 比值 ${ratio.toFixed(2)}`);
console.log(ratio <= 2.5 ? "✅ 达标(≤ 2.5)" : "⚠️ 偏斜(> 2.5),建议微调 weights");
process.exit(ratio <= 2.5 ? 0 : 1);
