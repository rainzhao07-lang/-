// 计分引擎:纯函数,同样的输入永远得到同样的输出。
// 规则(任务书§5):
// 1. 累加所有选项 weights → 最高分 persona 胜出;平分时按 personas.json 顺序取先者
// 2. 汇总所有 flags 为 hard_flags 对象(同名 key 后答的题覆盖先答的)
//    硬条件不改变人格结果,但必须注入报告 Prompt 改变建议内容
import { personas as defaultPersonas, questions as defaultQuestions } from "./content";
import type { HardFlags, Persona, Question, ScoreResult } from "./types";

/** 校验答案数组:长度与题目一致,且每项都是合法选项下标 */
export function validateAnswers(answers: unknown, qs: Question[] = defaultQuestions): answers is number[] {
  if (!Array.isArray(answers) || answers.length !== qs.length) return false;
  return answers.every(
    (a, i) => Number.isInteger(a) && a >= 0 && a < qs[i].options.length,
  );
}

/** 累加各 persona 得分(允许传入部分答案,用于答题中途的微反馈) */
export function accumulateScores(answers: number[], qs: Question[] = defaultQuestions): Record<string, number> {
  const scores: Record<string, number> = {};
  answers.forEach((optionIndex, i) => {
    const option = qs[i]?.options[optionIndex];
    if (!option) return;
    for (const [personaId, w] of Object.entries(option.weights)) {
      scores[personaId] = (scores[personaId] ?? 0) + w;
    }
  });
  return scores;
}

/** 取最高分 persona;平分(含全零)时按 personaOrder 顺序取先者,保证确定性 */
export function pickTopPersona(scores: Record<string, number>, personaOrder: string[]): string {
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

/** 汇总硬条件标记;同名 key 以后答的题为准 */
export function collectFlags(answers: number[], qs: Question[] = defaultQuestions): HardFlags {
  const flags: HardFlags = {};
  answers.forEach((optionIndex, i) => {
    const option = qs[i]?.options[optionIndex];
    if (!option) return;
    Object.assign(flags, option.flags);
  });
  return flags;
}

/** 完整计分:answers 必须是整套答案,非法输入抛错 */
export function scoreAnswers(
  answers: unknown,
  qs: Question[] = defaultQuestions,
  ps: Persona[] = defaultPersonas,
): ScoreResult {
  if (!validateAnswers(answers, qs)) {
    throw new Error("INVALID_ANSWERS");
  }
  const scores = accumulateScores(answers, qs);
  const personaId = pickTopPersona(scores, ps.map((p) => p.id));
  const hardFlags = collectFlags(answers, qs);
  return { personaId, scores, hardFlags };
}

/** 答题中途的当前领先 persona(微反馈用) */
export function topPersonaForPartial(
  partialAnswers: number[],
  qs: Question[] = defaultQuestions,
  ps: Persona[] = defaultPersonas,
): Persona {
  const scores = accumulateScores(partialAnswers, qs);
  const id = pickTopPersona(scores, ps.map((p) => p.id));
  return ps.find((p) => p.id === id) ?? ps[0];
}
