import reportVariantsJson from "@/content/reportVariants.json";
import { breedByName } from "./content";
import { pickVariant } from "./pick-variant";
import { premiumFlagLabel } from "./premium";
import type { BreedConflict, BreedProfile, HardFlags, Persona, PremiumFlags } from "./types";

export type LocalReportInput = {
  sessionId: string;
  persona: Persona;
  answersSummary: string[];
  hardFlags: HardFlags;
  premiumFlags: PremiumFlags;
  breedFacts?: BreedProfile;
  conflict?: BreedConflict;
};

type StyleCopy = {
  judgement: string;
  closing: string;
};

type CatName = { name: string; reason: string };
type ReportVariants = {
  opening: Record<string, string[]>;
  whyBreed: { default: string[] };
  realityIntro: { default: string[] };
  emotionIntro: { default: string[] };
  riskIntro: { default: string[] };
  altIntro: { default: string[] };
  checklistIntro: { default: string[] };
  tagTransition: { default: string[] };
  focus: { default: string[] };
  emotionParagraph: Record<string, string[]>;
  risk: Record<string, string[]>;
  noConflict: { default: string[] };
  advice: Record<string, string[]>;
  weave: Record<string, string[]>;
  comparisonClosing: { default: string[] };
  closingVerdict: Record<string, string[]>;
  catNames: Record<string, CatName[][]>;
};

const REPORT_VARIANTS = reportVariantsJson as ReportVariants;

const STYLE_COPY: Record<string, StyleCopy> = {
  gentle: {
    judgement: "更适合用循序渐进的方式进入养猫，先把让你安心的条件准备好。",
    closing: "你不用急着证明自己已经准备完美，把关键条件一项项补齐就够了。",
  },
  direct: {
    judgement: "先看预算、许可和医疗备用金，这些比一时喜欢更能决定长期体验。",
    closing: "如果这些条件没有确认，先缓一缓比冲动开始更负责。",
  },
  practical: {
    judgement: "你需要的是可执行的接猫路径：先确认限制，再准备用品，最后选择猫。",
    closing: "按清单推进，比靠感觉判断更稳定。",
  },
  emotional: {
    judgement: "你要的不只是可爱，而是一个能让生活变柔软、变稳定的陪伴关系。",
    closing: "当现实条件被照顾好，这份喜欢才更容易变成长期的安心。",
  },
};

export function localReportModelName(): string {
  return "local-rules-v1.4";
}

export function buildLocalReport(input: LocalReportInput): string {
  const styleKey = input.premiumFlags.report_style ?? "gentle";
  const breed = input.breedFacts;
  const premium = input.premiumFlags;
  const hard = input.hardFlags;
  const breedName = input.persona.primaryBreed.name;
  const wovenLines = wovenAnswerLines(input, breedName);
  const costLine = breed
    ? `参考月花费：主粮${formatRange(breed.costDetail.food)}元，猫砂${formatRange(breed.costDetail.litter)}元，其他护理/玩具/零食${formatRange(breed.costDetail.other)}元。`
    : "参考月花费需要按当地价格保守估算。";
  const healthLine = breed
    ? `护理与健康重点：${breed.healthRisks.join("、")}。`
    : "护理与健康重点建议以正规医院体检结果为准。";
  const conflictText = buildConflictText(input.conflict, breedName, input.sessionId);
  const risks = buildRisks(input);
  const names = catNamesForSession(input.sessionId, premium.emotional_need);
  const comparison = buildBreedComparison(input);
  const alternativeLines = [
    {
      name: input.persona.altBreeds[0]?.name ?? "田园猫",
      reason: input.persona.altBreeds[0]?.reason ?? "性格差异大，适合线下慢慢匹配",
    },
    {
      name: input.persona.altBreeds[1]?.name ?? "短毛猫",
      reason: input.persona.altBreeds[1]?.reason ?? "护理压力相对可控",
    },
  ].map(({ name, reason }) => `${name}:${withoutTerminalPeriod(reason)}。`);
  const closingVerdict = pickVariant(
    REPORT_VARIANTS.closingVerdict[input.persona.id] ?? [],
    input.sessionId,
    `verdict.${input.persona.id}`,
  );
  const starterKit = breed?.starterKit?.length ? breed.starterKit.join("、") : "猫薄荷玩具一件";
  const availabilityLine = breed?.availability === "mid"
    ? "说句实在的：这只在国内不算常见，如果缘分一时难寻，下面的备选同样契合，不必执着。"
    : "";

  const consentLine = consentAdvice(premium, hard);
  const report = [
    "## 你的猫系人格",
    pickVariant(
      REPORT_VARIANTS.opening[styleKey] ?? REPORT_VARIANTS.opening.gentle,
      input.sessionId,
      `opening.${styleKey}`,
    ),
    `你的测试结果是「${input.persona.title}」，关键词是「${input.persona.subtitle}」。${input.persona.verdict}`,
    input.persona.signatureParagraph,
    wovenLines.persona,
    pickVariant(REPORT_VARIANTS.tagTransition.default, input.sessionId, "tagTransition"),
    "",
    `## 为什么是${breedName}`,
    fillTemplate(pickVariant(REPORT_VARIANTS.whyBreed.default, input.sessionId, "whyBreed"), { breed: breedName }),
    input.persona.primaryBreed.reason,
    wovenLines.whyBreed,
    `${costLine}${healthLine} 如果你把它当作长期共同生活的成员，比起只看颜值，更应该提前理解它的护理成本、活动需求和性格波动。`,
    availabilityLine,
    "",
    "## 现实适配度",
    pickVariant(REPORT_VARIANTS.realityIntro.default, input.sessionId, "realityIntro"),
    `预算：${budgetAdvice(input.sessionId, premium, hard, breed)} ${premiumLabel("monthly_cat_budget", premium.monthly_cat_budget)}`,
    `空间：${housingAdvice(input.sessionId, hard, breed)}`,
    ...(consentLine ? [`居住许可：${consentLine}`] : []),
    `作息：${scheduleAdvice(input.sessionId, hard, breed)}`,
    `医疗承受力：${medicalAdvice(input.sessionId, premium, hard, breed)}`,
    wovenLines.reality,
    conflictText,
    "",
    "## 情绪需求",
    pickVariant(REPORT_VARIANTS.emotionIntro.default, input.sessionId, "emotionIntro"),
    emotionParagraph(input.sessionId, premium),
    decisionParagraph(input.sessionId, premium),
    "",
    "## 三个养猫风险和解决方案",
    pickVariant(REPORT_VARIANTS.riskIntro.default, input.sessionId, "riskIntro"),
    `1. ${risks[0]}`,
    `2. ${risks[1]}`,
    `3. ${risks[2]}`,
    "",
    "## 备选与行动清单",
    pickVariant(REPORT_VARIANTS.altIntro.default, input.sessionId, "altIntro"),
    ...alternativeLines,
    ...comparison,
    pickVariant(REPORT_VARIANTS.checklistIntro.default, input.sessionId, "checklistIntro"),
    "第一个月准备清单：航空箱、封闭或半封闭猫砂盆、低粉尘猫砂、主粮试吃装、稳定饮水点、抓板、逗猫棒、基础体检预算、驱虫安排、常去医院名单。",
    `为${breedName}多准备：${starterKit}。`,
    `猫名彩蛋：${names.map((item) => `${item.name}(${item.reason})`).join("、")}。`,
    "",
    closingVerdict,
    "倡导领养代替购买，这些性格特质在田园猫中同样存在。本报告为参考建议，每只猫都是独立的个体。",
  ].filter(Boolean).join("\n\n");

  return normalizeChinesePunctuation(report);
}

export async function* generateLocalReportStream(input: LocalReportInput): AsyncGenerator<string> {
  const report = buildLocalReport(input);
  const chunkSize = 72;
  for (let i = 0; i < report.length; i += chunkSize) {
    yield report.slice(i, i + chunkSize);
  }
}

function premiumLabel(key: string, value?: string): string {
  return value ? premiumFlagLabel(key, value) : "这一项信息暂缺，建议按保守预算处理。";
}

function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (placeholder, key: string) => values[key] ?? placeholder);
}

function answerText(summary: string): string {
  const [, answer = summary] = summary.split(/\s*→\s*/, 2);
  return answer.trim();
}

function answerCategory(summary: string): string | null {
  const [question] = summary.split(/\s*→\s*/, 1);
  const mappings: Array<[RegExp, string]> = [
    [/几点睡|周五晚上|作息/, "schedule"],
    [/掉毛/, "shedding"],
    [/下班回家|陪伴|互动/, "care_time"],
    [/急诊|医疗|生病/, "medical"],
    [/住的地方|住在哪里|空间/, "space"],
    [/买东西|月预算|预算/, "budget"],
    [/能不能养|室友|家人|房东|居住许可/, "consent"],
  ];
  return mappings.find(([pattern]) => pattern.test(question))?.[1] ?? null;
}

function wovenAnswerLines(input: LocalReportInput, breedName: string): {
  persona: string;
  whyBreed: string;
  reality: string;
} {
  const candidates = input.answersSummary
    .map((summary, index) => ({
      category: answerCategory(summary),
      answer: answerText(summary),
      index,
    }))
    .filter((item): item is { category: string; answer: string; index: number } => (
      Boolean(item.category && item.answer && REPORT_VARIANTS.weave[item.category]?.length)
    ))
    .map((item) => ({
      ...item,
      signal: answerSignalStrength(input.hardFlags, item.category),
    }))
    .filter((item) => item.signal > 0);

  const selectedCategories = new Set<string>();
  const selectForSlot = (slot: string, allowedCategories: string[]): string => {
    const eligible = candidates.filter((candidate) => (
      allowedCategories.includes(candidate.category)
      && !selectedCategories.has(candidate.category)
    ));
    if (eligible.length === 0) return "";
    const strongestSignal = Math.max(...eligible.map((candidate) => candidate.signal));
    const strongest = eligible.filter((candidate) => candidate.signal === strongestSignal);
    const item = pickVariant(strongest, input.sessionId, `weave.slot.${slot}`);

    selectedCategories.add(item.category);
    return fillTemplate(
      pickVariant(REPORT_VARIANTS.weave[item.category], input.sessionId, `weave.${item.category}`),
      { answer: item.answer, breed: breedName },
    );
  };

  return {
    persona: selectForSlot("persona", ["schedule", "care_time", "shedding"]),
    whyBreed: selectForSlot("whyBreed", ["care_time", "schedule"]),
    reality: selectForSlot("reality", ["medical", "budget", "consent", "space"]),
  };
}

function answerSignalStrength(hardFlags: HardFlags, category: string): number {
  const values: Record<string, Record<string, number>> = {
    consent: { blocked: 100, negotiating: 90, discussed: 40, clear: 20 },
    medical: { low: 90, tight: 80, mid: 50, high: 20 },
    budget: { low: 80, mid: 50, high: 20 },
    space: { small: 75, medium: 45, large: 20 },
    shedding: { low: 70, mid: 40, high: 20 },
    care_time: { low: 65, mid: 40, high: 20 },
    schedule: { irregular: 60, busy: 60, night: 50, normal: 30, regular: 20 },
  };
  const flagKey = category === "medical" ? "medical_buffer" : category;
  const flagValue = hardFlags[flagKey];
  return flagValue ? values[category]?.[flagValue] ?? 0 : 0;
}

function catNamesForSession(sessionId: string, emotionalNeed?: string): CatName[] {
  const need = emotionalNeed && REPORT_VARIANTS.catNames[emotionalNeed]
    ? emotionalNeed
    : "companionship";
  const groups = REPORT_VARIANTS.catNames[need] ?? [];
  if (groups.length === 0) return [];
  return pickVariant(groups, sessionId, `names.${need}`);
}

function buildBreedComparison(input: LocalReportInput): string[] {
  const main = input.breedFacts ?? breedByName(input.persona.primaryBreed.name);
  const alternatives = input.persona.altBreeds
    .slice(0, 2)
    .map((item) => breedByName(item.name))
    .filter((item): item is BreedProfile => Boolean(item));
  const compared = [main, ...alternatives].filter((item): item is BreedProfile => Boolean(item));
  if (compared.length < 3) return [];

  const remainingDimensions = [
    { key: "cost", priority: input.hardFlags.budget === "low" ? 0 : 10 },
    { key: "space", priority: input.hardFlags.space === "small" ? 1 : 10 },
    { key: "shedding", priority: input.hardFlags.shedding === "low" ? 2 : 10 },
    { key: "clinginess", priority: input.hardFlags.care_time === "low" ? 3 : 10 },
  ].filter(({ key }) => comparisonHasVariation(key, compared));
  const dimensions: typeof remainingDimensions = [];
  while (remainingDimensions.length > 0 && dimensions.length < 3) {
    const highestPriority = Math.min(...remainingDimensions.map((item) => item.priority));
    const candidates = remainingDimensions.filter((item) => item.priority === highestPriority);
    const selected = pickVariant(candidates, input.sessionId, `comparison.dimension.${dimensions.length}`);
    dimensions.push(selected);
    remainingDimensions.splice(remainingDimensions.indexOf(selected), 1);
  }
  if (dimensions.length < 2) return [];

  const lines = dimensions.map(({ key }) => comparisonLine(key, compared));
  const lowerPressure = chooseLowerPressureBreed(compared, dimensions.map((item) => item.key));
  const constraintDimensions = dimensions.slice(0, 2).map((item) => comparisonDimensionLabel(item.key));
  const closing = fillTemplate(
    pickVariant(REPORT_VARIANTS.comparisonClosing.default, input.sessionId, "comparison.closing"),
    {
      维度A: constraintDimensions[0],
      维度B: constraintDimensions[1],
      低压选项: lowerPressure.name,
      主推: compared[0].name,
    },
  );

  return ["在你最在意的几个维度上，把三只放在一起看：", ...lines, closing];
}

function comparisonHasVariation(key: string, breeds: BreedProfile[]): boolean {
  const values = breeds.map((breed) => {
    if (key === "cost") {
      const minimum = breed.costDetail.food[0] + breed.costDetail.litter[0] + breed.costDetail.other[0];
      const maximum = breed.costDetail.food[1] + breed.costDetail.litter[1] + breed.costDetail.other[1];
      return `${minimum}-${maximum}`;
    }
    if (key === "space") return breed.smallSpaceFit;
    return breed[key as "shedding" | "clinginess"];
  });
  return new Set(values).size > 1;
}

function comparisonLine(key: string, breeds: BreedProfile[]): string {
  if (key === "cost") {
    return `月花费(主粮+猫砂+护理合计)：${breeds.map((breed) => {
      const minimum = breed.costDetail.food[0] + breed.costDetail.litter[0] + breed.costDetail.other[0];
      const maximum = breed.costDetail.food[1] + breed.costDetail.litter[1] + breed.costDetail.other[1];
      return `${breed.name}${minimum}-${maximum}元`;
    }).join("；")}。`;
  }
  if (key === "shedding") {
    return `掉毛压力：${breeds.map((breed) => `${breed.name}${levelLabel(breed.shedding)}`).join("；")}。`;
  }
  if (key === "space") {
    return `小空间适配：${breeds.map((breed) => `${breed.name}${levelLabel(breed.smallSpaceFit)}`).join("；")}。`;
  }
  return `粘人程度：${breeds.map((breed) => `${breed.name}${levelLabel(breed.clinginess)}`).join("；")}。`;
}

function levelLabel(level: string): string {
  const labels: Record<string, string> = {
    low: "低",
    low_mid: "中低",
    mid: "中",
    mid_high: "中高",
    high: "高",
  };
  return labels[level] ?? level;
}

function comparisonDimensionLabel(key: string): string {
  return {
    shedding: "掉毛",
    cost: "预算",
    space: "空间",
    clinginess: "陪伴时间",
  }[key] ?? key;
}

function chooseLowerPressureBreed(breeds: BreedProfile[], dimensions: string[]): BreedProfile {
  const levels: Record<string, number> = { low: 1, low_mid: 2, mid: 3, mid_high: 4, high: 5 };
  return [...breeds].sort((left, right) => {
    const pressure = (breed: BreedProfile) => dimensions.reduce((total, key) => {
      if (key === "cost") {
        return total + breed.costDetail.food[1] + breed.costDetail.litter[1] + breed.costDetail.other[1];
      }
      if (key === "space") return total + (6 - (levels[breed.smallSpaceFit] ?? 3)) * 100;
      return total + (levels[breed[key as "shedding" | "clinginess"]] ?? 3) * 100;
    }, 0);
    return pressure(left) - pressure(right);
  })[0];
}

function budgetAdvice(
  sessionId: string,
  premium: PremiumFlags,
  hard: HardFlags,
  breed?: BreedProfile,
): string {
  const budgetSafety = premium.budget_safety;
  const monthlyCost = breed?.monthlyCost;
  if (budgetSafety === "low" || hard.budget === "low") {
    const current = monthlyCost === "high" || monthlyCost === "mid_high"
      ? "这只猫的长期花费会明显考验预算，建议先准备至少3个月固定养猫预算和单独医疗备用金。"
      : "可以从基础稳定配置开始，但不要把猫粮、猫砂和驱虫压到过低标准。";
    return pickAdviceBody(current, "budgetTight", "预算", sessionId);
  }
  if (budgetSafety === "high" || budgetSafety === "good") {
    return pickAdviceBody(
      "预算压力不是最大问题，更重要的是别被高价用品带偏，把钱优先放在主粮、体检和医疗备用金上。",
      "budgetComfortable",
      "预算",
      sessionId,
    );
  }
  return pickAdviceBody(
    "预算处在可计划区间，适合先定月度上限，再决定品种和用品档位。",
    "budgetPlanned",
    "预算",
    sessionId,
  );
}

function housingAdvice(sessionId: string, hard: HardFlags, breed?: BreedProfile): string {
  if (hard.space === "small") {
    if (breed?.smallSpaceFit === "low") {
      return "空间会是主要限制，建议优先考虑活动量更低、适应小空间更好的备选猫。";
    }
    return pickAdviceBody(
      "空间不是不能养，但要把垂直活动区、猫砂盆位置和收纳动线提前设计好。",
      "spaceTight",
      "空间",
      sessionId,
    );
  }
  return pickAdviceBody(
    "居住条件相对稳定，适合做长期规划，重点是保持固定活动区和安静休息区。",
    "spaceStable",
    "空间",
    sessionId,
  );
}

function consentAdvice(premium: PremiumFlags, hard: HardFlags): string | null {
  const consent = hard.consent;
  const sharedHome = premium.home_control === "shared" || premium.home_control === "negotiated";
  if (!consent && !sharedHome) return null;
  if (consent === "blocked" || consent === "negotiating" || sharedHome) {
    return "你需要先确认室友、家人或房东的许可，并把猫砂盆、抓板和活动范围写成明确方案。";
  }
  return "居住许可已经比较明确，接猫前再把日常分工和活动范围确认一次。";
}

function scheduleAdvice(sessionId: string, hard: HardFlags, breed?: BreedProfile): string {
  if (hard.care_time === "low" || hard.schedule === "busy" || hard.schedule === "irregular") {
    if (breed?.activity === "high" || breed?.clinginess === "high") {
      return "你的时间安排和高互动猫会有拉扯，需要固定每日陪玩窗口，否则猫会用夜间活动提醒你。";
    }
    return pickAdviceBody(
      "可以选择更独立的相处节奏，但喂食、清洁和陪玩仍要固定到日程里。",
      "scheduleIndependent",
      "作息",
      sessionId,
    );
  }
  if (hard.schedule === "night") {
    return "夜间作息不代表不能养，但要提前训练睡前陪玩和固定喂食，减少半夜跑动。";
  }
  return pickAdviceBody(
    "你的作息相对可控，适合用固定喂食、清洁和陪玩建立猫的安全感。",
    "scheduleRegular",
    "作息",
    sessionId,
  );
}

function medicalAdvice(
  sessionId: string,
  premium: PremiumFlags,
  hard: HardFlags,
  breed?: BreedProfile,
): string {
  if (premium.premium_medical_buffer === "weak" || hard.medical_buffer === "low") {
    return pickAdviceBody(
      "现在最需要补的是医疗备用金。建议先把体检、疫苗、驱虫和突发就诊预算单独留出来，再决定接猫时间。",
      "medicalTight",
      "医疗承受力",
      sessionId,
    );
  }
  if (premium.premium_medical_buffer === "reserved") {
    return pickAdviceBody(
      "你愿意提前准备医疗备用金，这是很成熟的信号。下一步是确认附近靠谱医院和夜间急诊选择。",
      "medicalPrepared",
      "医疗承受力",
      sessionId,
    );
  }
  if (breed?.vetRisk === "high") {
    return "这个品种有更高的健康管理要求，即使你能承受基础医疗，也建议提前做品种风险功课和年度体检计划。";
  }
  return "医疗承受力处在可规划范围内，重点是不要等生病后才第一次了解医院和费用。";
}

function pickAdviceBody(
  current: string,
  key: string,
  label: string,
  sessionId: string,
): string {
  const selected = pickVariant([current, ...(REPORT_VARIANTS.advice[key] ?? [])], sessionId, `advice.${key}`);
  const prefix = `${label}：`;
  return selected.startsWith(prefix) ? selected.slice(prefix.length) : selected;
}

function buildConflictText(conflict: BreedConflict | undefined, breedName: string, sessionId: string): string {
  if (!conflict?.hasConflict) {
    return pickVariant(REPORT_VARIANTS.noConflict.default, sessionId, "conflict.none");
  }
  return `综合判断：你的${conflict.typeLabels.join("、")}和${breedName}存在现实拉扯。建议不是否定这份喜欢，而是先把相关条件补齐；如果想更稳，可以认真看看${conflict.softAlternative ?? "维护压力更低的猫"}。${STYLE_COPY.direct.closing}`;
}

function emotionParagraph(sessionId: string, premium: PremiumFlags): string {
  const need = premium.emotional_need ?? "companionship";
  const variants = REPORT_VARIANTS.emotionParagraph[need]
    ?? REPORT_VARIANTS.emotionParagraph.companionship
    ?? [];
  return pickVariant(variants, sessionId, `emotion.${need}`);
}

function decisionParagraph(sessionId: string, premium: PremiumFlags): string {
  if (premium.decision_goal === "whether_now") {
    return "所以报告最后给你的核心判断是：不要只问想不想养，要问预算、许可、医疗和时间是否已经能连续稳定三个月。";
  }
  if (premium.decision_goal === "which_cat") {
    return pickVariant(REPORT_VARIANTS.focus.default, sessionId, "decision.focus");
  }
  if (premium.decision_goal === "avoid_list") {
    return "你最需要避开的坑是：只看颜值、忽略医疗预算、没有确认同住者态度、用品一次性买太满。";
  }
  if (premium.decision_goal === "prep_list") {
    return "你的重点应该放在准备顺序：先预算和许可，再医院和用品，最后才是看猫和接猫。";
  }
  return "你想理解自己为什么这么想养猫。答案可能是你正在寻找一种稳定、柔软、不会过度消耗你的亲密关系。";
}

function buildRisks(input: LocalReportInput): [string, string, string] {
  const premium = input.premiumFlags;
  const first = riskForMainWorry(premium.main_worry, input.sessionId);
  const second = input.conflict?.hasConflict
    ? `匹配风险：上面综合判断里提到的两件事，是你最该先解决的。解决方案：先完成对应准备，再把${input.persona.primaryBreed.name}和${input.conflict.softAlternative ?? "更低维护的猫"}放在同一张表里比较。`
    : pickVariant(REPORT_VARIANTS.risk.matching, input.sessionId, "risk.matching");
  const third = medicalOrRoutineRisk(input);
  return [first, second, third];
}

function riskForMainWorry(worry: string | undefined, sessionId: string): string {
  if (worry === "cleaning") {
    return pickVariant(REPORT_VARIANTS.risk.cleaning, sessionId, "risk.cleaning");
  }
  if (worry === "medical") {
    return "医疗风险：猫生病时花费和决策会同时压上来。解决方案：先列附近医院、夜间急诊和基础体检价格，再准备备用金。";
  }
  if (worry === "time") {
    return "时间风险：忙起来容易只剩喂食清砂。解决方案：每天固定两段10分钟互动，比偶尔补偿式陪玩更有效。";
  }
  if (worry === "consent") {
    return "许可风险：家人、室友或房东态度不清会让养猫变成长期拉扯。解决方案：先拿到明确同意，再谈接猫。";
  }
  if (worry === "mismatch") {
    return "性格不合风险：你想象中的猫和真实的猫可能不同。解决方案：优先线下接触，给自己和猫都留试探空间。";
  }
  return pickVariant(REPORT_VARIANTS.risk.cost, sessionId, "risk.cost");
}

function medicalOrRoutineRisk(input: LocalReportInput): string {
  if (input.premiumFlags.premium_medical_buffer === "weak" || input.hardFlags.medical_buffer === "low") {
    return pickVariant(REPORT_VARIANTS.risk.emergency, input.sessionId, "risk.emergency");
  }
  if (input.hardFlags.care_time === "low") {
    return "陪伴风险：你可能会低估猫对稳定互动的需要。解决方案：把陪玩和观察状态写进日程，不要只靠周末补。";
  }
  return "新手风险：前一个月最容易因为用品、喂食和清洁节奏慌乱。解决方案：用品少而准，每天记录食欲、排便和精神状态。";
}

function formatRange(range: [number, number]): string {
  return `${range[0]}-${range[1]}`;
}

function withoutTerminalPeriod(value: string): string {
  return value.replace(/。$/, "");
}

function normalizeChinesePunctuation(value: string): string {
  const urls: string[] = [];
  const protectedValue = value.replace(
    /https?:\/\/[^\s，。：；？！）】》」』”’]+/g,
    (url) => {
      const token = `\uE000${urls.length}\uE001`;
      urls.push(url);
      return token;
    },
  );

  return protectedValue
    .replace(/,/g, "，")
    .replace(/:/g, "：")
    .replace(/;/g, "；")
    .replace(/\?/g, "？")
    .replace(/!/g, "！")
    .replace(/\uE000(\d+)\uE001/g, (_, index: string) => urls[Number(index)]);
}
