// 计分引擎:纯函数,同样的输入永远得到同样的输出。
// 评分规则:
// 1. 累加所有选项 weights → 最高分 persona 胜出;平分时按 personas.json 顺序取先者
// 2. 汇总所有 flags 为 hard_flags 对象(同名 key 后答的题覆盖先答的)
//    硬条件不改变人格结果,但会触发现实适配提示并注入本地报告生成器
import { breedByName, breeds as defaultBreeds, personas as defaultPersonas, questions as defaultQuestions } from "./content";
import type { BreedConflict, BreedConflictType, BreedProfile, HardFlags, Persona, Question, ScoreResult } from "./types";

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

const CONFLICT_LABELS: Record<BreedConflictType, string> = {
  shedding: "掉毛底线",
  budget: "预算安排",
  space: "居住空间",
  beginner: "新手友好度",
  availability: "国内可获得性",
  time: "陪伴时间",
  medical: "医疗预算",
  allergy: "过敏风险",
  consent: "居住许可",
  noise: "夜间安静需求",
};

/**
 * 检测人格猫与现实条件的冲突。
 * 原理:人格仍负责"情绪命中",硬条件负责提醒现实成本,避免把浪漫结果误包装成无条件推荐。
 */
export function detectBreedConflict(
  persona: Persona,
  hardFlags: HardFlags,
  source: Record<string, BreedProfile> = defaultBreeds,
): BreedConflict {
  const primary = breedByName(persona.primaryBreed.name, source);
  const types: BreedConflictType[] = [];

  if (!primary) {
    return {
      hasConflict: true,
      types: ["availability"],
      typeLabels: [CONFLICT_LABELS.availability],
      primaryBreed: persona.primaryBreed.name,
      message: "这个品种的事实数据还没补齐,上线前需要人工复核。",
    };
  }

  if (hardFlags.shedding === "low" && primary.shedding === "high") types.push("shedding");
  if (hardFlags.budget === "low" && (primary.monthlyCost === "mid_high" || primary.monthlyCost === "high")) {
    types.push("budget");
  }
  if (hardFlags.space === "small" && primary.smallSpaceFit === "low") types.push("space");
  if ((hardFlags.experience === "newbie" || hardFlags.beginner === "true") && primary.beginnerFit === "low") {
    types.push("beginner");
  }
  if (hardFlags.care_time === "low" && (primary.activity === "high" || primary.clinginess === "high")) {
    types.push("time");
  }
  if ((hardFlags.medical_buffer === "low" || hardFlags.medical_buffer === "tight") && primary.vetRisk === "high") {
    types.push("medical");
  }
  if (hardFlags.allergy === "sensitive" && primary.shedding === "high") types.push("allergy");
  if (hardFlags.consent === "blocked") types.push("consent");
  if (hardFlags.trouble === "night_noise" && primary.activity === "high") types.push("noise");
  if (primary.availability === "low") types.push("availability");

  const uniqueTypes = [...new Set(types)];
  const alternative = persona.altBreeds.find((candidate) => {
    const profile = breedByName(candidate.name, source);
    return profile ? !hasSameConflict(profile, hardFlags, uniqueTypes) && profile.availability !== "low" : false;
  });

  const typeLabels = uniqueTypes.map((type) => CONFLICT_LABELS[type]);
  const softAlternative = alternative?.name;
  const message = buildConflictMessage(persona.primaryBreed.name, typeLabels, softAlternative, uniqueTypes);

  return {
    hasConflict: uniqueTypes.length > 0,
    types: uniqueTypes,
    typeLabels,
    primaryBreed: persona.primaryBreed.name,
    softAlternative,
    softAlternativeReason: alternative?.reason,
    message,
  };
}

function hasSameConflict(profile: BreedProfile, hardFlags: HardFlags, types: BreedConflictType[]): boolean {
  return types.some((type) => {
    if (type === "shedding") return hardFlags.shedding === "low" && profile.shedding === "high";
    if (type === "budget") return hardFlags.budget === "low" && (profile.monthlyCost === "mid_high" || profile.monthlyCost === "high");
    if (type === "space") return hardFlags.space === "small" && profile.smallSpaceFit === "low";
    if (type === "beginner") return (hardFlags.experience === "newbie" || hardFlags.beginner === "true") && profile.beginnerFit === "low";
    if (type === "availability") return profile.availability === "low";
    if (type === "time") return hardFlags.care_time === "low" && (profile.activity === "high" || profile.clinginess === "high");
    if (type === "medical") return (hardFlags.medical_buffer === "low" || hardFlags.medical_buffer === "tight") && profile.vetRisk === "high";
    if (type === "allergy") return hardFlags.allergy === "sensitive" && profile.shedding === "high";
    if (type === "consent") return hardFlags.consent === "blocked";
    if (type === "noise") return hardFlags.trouble === "night_noise" && profile.activity === "high";
    return false;
  });
}

function buildConflictMessage(
  primaryBreed: string,
  typeLabels: string[],
  softAlternative: string | undefined,
  types: BreedConflictType[],
): string | undefined {
  if (types.length === 0) return undefined;
  if (types.includes("consent") && !softAlternative) {
    return `你的人格猫是${primaryBreed},不过看你的${typeLabels.join("、")},现实里要先把“能不能养”的条件定下来。为什么?完整报告里聊。`;
  }
  return `你的人格猫是${primaryBreed},不过看你的${typeLabels.join("、")},现实里更稳的搭档也许是${softAlternative ?? "更低维护的猫"}。为什么?完整报告里聊。`;
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
