import { premiumQuestions as defaultPremiumQuestions } from "./content";
import type { PremiumFlags, PremiumQuestion } from "./types";

export const PREMIUM_FLAG_LABELS: Record<string, Record<string, string>> = {
  monthly_cat_budget: {
    under_300: "可接受月均养猫预算300元以内",
    "300_600": "可接受月均养猫预算300-600元",
    "600_1000": "可接受月均养猫预算600-1000元",
    over_1000: "可接受月均养猫预算1000元以上",
  },
  budget_safety: {
    low: "预算安全垫偏低,需要控制品种和用品选择",
    medium: "预算安全垫中等,适合基础稳定配置",
    good: "预算安全垫较好,能覆盖更稳的日常配置",
    high: "预算安全垫较高,更在意省心和品质",
  },
  premium_medical_buffer: {
    weak: "面对2000-5000元突发医疗开销会明显吃力",
    medium: "能处理2000-5000元突发医疗,但会影响当月安排",
    strong: "基本可以承受2000-5000元突发医疗",
    reserved: "愿意提前准备猫咪医疗备用金",
  },
  risk_tolerance: {
    low: "风险承受力偏谨慎",
    medium: "风险承受力中等",
    high: "风险承受力较强",
    planned: "倾向提前规划风险",
  },
  emotional_need: {
    companionship: "核心情绪需求是稳定陪伴",
    comfort: "核心情绪需求是被安慰和被接住",
    routine: "核心情绪需求是建立生活秩序",
    playfulness: "核心情绪需求是互动和快乐",
    uncertain: "还在探索自己为什么想靠近猫",
  },
  bond_style: {
    stable: "期待稳定长期的亲密关系",
    healing: "期待温柔疗愈的相处关系",
    structured: "期待彼此带来生活秩序",
    interactive: "期待活泼互动的相处关系",
    exploring: "对猫的情感投射仍在探索中",
  },
  main_worry: {
    cost: "最担心长期花费",
    cleaning: "最担心清洁压力",
    medical: "最担心生病和医疗",
    time: "最担心时间精力不够",
    consent: "最担心家人、室友或房东许可",
    mismatch: "最担心和猫性格不合",
  },
  prep_focus: {
    budget_plan: "准备重点应放在预算表和应急金",
    home_cleaning: "准备重点应放在清洁动线和用品",
    medical_plan: "准备重点应放在医疗预案",
    routine_plan: "准备重点应放在作息和陪伴安排",
    permission_plan: "准备重点应放在居住许可沟通",
    matching_plan: "准备重点应放在领养/接猫前的性格匹配",
  },
  report_style: {
    gentle: "报告语气偏温柔",
    direct: "报告语气偏直接",
    practical: "报告语气偏实用",
    emotional: "报告语气偏有情绪共鸣",
  },
  advice_tone: {
    soft: "建议要像认真懂你的朋友",
    clear: "建议要直接说透关键问题",
    actionable: "建议要多给清单和判断标准",
    resonant: "建议要更强调情绪共鸣",
  },
  premium_housing: {
    rental: "租房独住,规则相对自己决定",
    shared: "合租,需要顾及室友和公共区域",
    alone: "独居且比较稳定,能长期规划",
    family_partner: "和家人或伴侣同住,需要共同确认",
    owned: "自有住房,空间和规则比较稳定",
  },
  home_control: {
    medium: "居住控制权中等",
    shared: "居住控制权需要与他人共享",
    high: "居住控制权较高",
    negotiated: "居住控制权需要协商",
  },
  decision_goal: {
    whether_now: "最想判断现在是否适合开始养",
    which_cat: "最想判断哪类猫适合自己",
    avoid_list: "最想知道应该避开哪些坑",
    prep_list: "最想知道需要先准备什么",
    self_understanding: "最想理解自己为什么这么想养猫",
  },
  final_focus: {
    readiness: "报告结尾要重点回答准备度",
    breed_match: "报告结尾要重点回答品种匹配",
    risk_avoidance: "报告结尾要重点回答避坑清单",
    preparation: "报告结尾要重点回答准备清单",
    self_insight: "报告结尾要重点回答自我理解",
  },
};

export function validatePremiumAnswers(
  answers: unknown,
  qs: PremiumQuestion[] = defaultPremiumQuestions,
): answers is number[] {
  if (!Array.isArray(answers) || answers.length !== qs.length) return false;
  return answers.every((answer, i) => (
    Number.isInteger(answer) && answer >= 0 && answer < qs[i].options.length
  ));
}

export function collectPremiumFlags(
  answers: number[],
  qs: PremiumQuestion[] = defaultPremiumQuestions,
): PremiumFlags {
  const flags: PremiumFlags = {};
  answers.forEach((optionIndex, i) => {
    const option = qs[i]?.options[optionIndex];
    if (option) Object.assign(flags, option.flags);
  });
  return flags;
}

export function premiumFlagLabel(key: string, value: string): string {
  return PREMIUM_FLAG_LABELS[key]?.[value] ?? `${key}: ${value}`;
}

export function describePremiumFlags(flags?: PremiumFlags | null): string[] {
  if (!flags) return [];
  return Object.entries(flags).map(([key, value]) => premiumFlagLabel(key, value));
}

export function hasPremiumFlags(flags?: PremiumFlags | null): flags is PremiumFlags {
  return Boolean(flags && Object.keys(flags).length > 0);
}

export function canGeneratePaidReport(session: {
  paid: boolean;
  premiumFlags?: PremiumFlags | null;
}): boolean {
  return session.paid && hasPremiumFlags(session.premiumFlags);
}

export function canAccessPremiumCard(session: {
  paid: boolean;
  premiumFlags?: PremiumFlags | null;
}): boolean {
  return canGeneratePaidReport(session);
}
