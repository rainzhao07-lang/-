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
  lead: string;
  judgement: string;
  closing: string;
};

const HARD_FLAG_LABELS: Record<string, Record<string, string>> = {
  schedule: {
    regular: "作息规律",
    normal: "作息略晚但基本稳定",
    night: "夜间精力更活跃",
    irregular: "作息不固定",
    busy: "日常比较忙",
  },
  space: {
    small: "空间偏紧",
    medium: "小户型或中等空间",
    large: "居住空间宽裕",
  },
  budget: {
    low: "基础预算偏谨慎",
    mid: "预算有计划",
    high: "预算弹性较高",
  },
  shedding: {
    low: "对掉毛很敏感",
    mid: "能接受少量掉毛",
    high: "对掉毛不太介意",
  },
  care_time: {
    low: "稳定陪伴时间偏少",
    mid: "能保持轻量互动",
    high: "愿意主动陪玩",
  },
  consent: {
    clear: "居住许可明确",
    discussed: "已基本沟通过",
    negotiating: "居住许可还在沟通",
    blocked: "居住许可存在阻力",
  },
  medical_buffer: {
    high: "突发医疗承受力较强",
    mid: "能安排基础医疗支出",
    tight: "医疗支出需要谨慎规划",
    low: "突发医疗压力较大",
  },
};

const STYLE_COPY: Record<string, StyleCopy> = {
  gentle: {
    lead: "这份报告会尽量温柔地把你的期待和现实条件放在一起看。",
    judgement: "更适合用循序渐进的方式进入养猫,先把让你安心的条件准备好。",
    closing: "你不用急着证明自己已经准备完美,把关键条件一项项补齐就够了。",
  },
  direct: {
    lead: "这份报告会直接给出判断:哪里适合,哪里需要先补课。",
    judgement: "先看预算、许可和医疗备用金,这些比一时喜欢更能决定长期体验。",
    closing: "如果这些条件没有确认,先缓一缓比冲动开始更负责。",
  },
  practical: {
    lead: "这份报告会尽量把结论落到清单、预算和执行步骤上。",
    judgement: "你需要的是可执行的接猫路径:先确认限制,再准备用品,最后选择猫。",
    closing: "按清单推进,比靠感觉判断更稳定。",
  },
  emotional: {
    lead: "这份报告会更认真地照顾你为什么想靠近一只猫。",
    judgement: "你要的不只是可爱,而是一个能让生活变柔软、变稳定的陪伴关系。",
    closing: "当现实条件被照顾好,这份喜欢才更容易变成长期的安心。",
  },
};

export function localReportModelName(): string {
  return "local-rules-v1";
}

export function buildLocalReport(input: LocalReportInput): string {
  const style = STYLE_COPY[input.premiumFlags.report_style] ?? STYLE_COPY.gentle;
  const breed = input.breedFacts;
  const premium = input.premiumFlags;
  const hard = input.hardFlags;
  const breedName = input.persona.primaryBreed.name;
  const costLine = breed
    ? `参考月花费:主粮${formatRange(breed.costDetail.food)}元,猫砂${formatRange(breed.costDetail.litter)}元,其他护理/玩具/零食${formatRange(breed.costDetail.other)}元。`
    : "参考月花费需要按当地价格保守估算。";
  const healthLine = breed
    ? `护理与健康重点:${breed.healthRisks.join("、")}。`
    : "护理与健康重点建议以正规医院体检结果为准。";
  const clues = compactClues(input.answersSummary);
  const conflictText = buildConflictText(input.conflict, breedName);
  const risks = buildRisks(input);
  const names = catNamesFor(premium.emotional_need);

  return [
    "## 你的猫系人格",
    `${style.lead} 你的测试结果是「${input.persona.title}」,关键词是「${input.persona.subtitle}」。${input.persona.verdict}`,
    input.persona.signatureParagraph,
    `从基础题看,你身上的线索是:${hardSummary(hard)}。${clues ? `其中最有参考价值的几条答案是:${clues}。` : ""}`,
    `这些不是给你贴标签,而是说明你在亲密关系里既需要温度,也需要边界和节奏——一只合适的猫,恰好懂得怎么和这样的你相处。`,
    "",
    `## 为什么是${breedName}`,
    `${breedName}成为你的本命猫,不是因为它只符合一个单点偏好,而是它和你的生活节奏、互动期待、承受边界更容易形成稳定匹配。${input.persona.primaryBreed.reason}`,
    `${costLine}${healthLine} 如果你把它当作长期共同生活的成员,比起只看颜值,更应该提前理解它的护理成本、活动需求和性格波动。`,
    "",
    "## 现实适配度",
    `预算:${budgetAdvice(premium, hard, breed)} ${premiumLabel("monthly_cat_budget", premium.monthly_cat_budget)}`,
    `空间:${housingAdvice(premium, hard, breed)}`,
    `作息:${scheduleAdvice(hard, breed)}`,
    `医疗承受力:${medicalAdvice(premium, hard, breed)}`,
    conflictText,
    "",
    "## 情绪需求",
    emotionParagraph(premium, style),
    decisionParagraph(premium),
    "",
    "## 三个养猫风险和解决方案",
    `1. ${risks[0]}`,
    `2. ${risks[1]}`,
    `3. ${risks[2]}`,
    "",
    "## 备选与行动清单",
    `${input.persona.altBreeds[0]?.name ?? "田园猫"}:${input.persona.altBreeds[0]?.reason ?? "性格差异大,适合线下慢慢匹配"}。${input.persona.altBreeds[1]?.name ?? "短毛猫"}:${input.persona.altBreeds[1]?.reason ?? "护理压力相对可控"}。这两只不是退而求其次,而是给你保留现实弹性。`,
    "第一个月准备清单:航空箱、封闭或半封闭猫砂盆、低粉尘猫砂、主粮试吃装、稳定饮水点、抓板、逗猫棒、基础体检预算、驱虫安排、常去医院名单。",
    `猫名彩蛋:${names.map((item) => `${item.name}(${item.reason})`).join("、")}。`,
    "",
    `${style.closing} 倡导领养代替购买,这些性格特质在田园猫中同样存在。本报告为参考建议,每只猫都是独立的个体。`,
  ].join("\n\n");
}

export async function* generateLocalReportStream(input: LocalReportInput): AsyncGenerator<string> {
  const report = buildLocalReport(input);
  const chunkSize = 72;
  for (let i = 0; i < report.length; i += chunkSize) {
    yield report.slice(i, i + chunkSize);
  }
}

function premiumLabel(key: string, value?: string): string {
  return value ? premiumFlagLabel(key, value) : "这一项信息暂缺,建议按保守预算处理。";
}

function hardLabel(key: string, value?: string): string | null {
  if (!value) return null;
  return HARD_FLAG_LABELS[key]?.[value] ?? null;
}

function hardSummary(flags: HardFlags): string {
  const labels = [
    hardLabel("schedule", flags.schedule),
    hardLabel("space", flags.space),
    hardLabel("budget", flags.budget),
    hardLabel("shedding", flags.shedding),
    hardLabel("care_time", flags.care_time),
    hardLabel("consent", flags.consent),
    hardLabel("medical_buffer", flags.medical_buffer),
  ].filter(Boolean);
  return labels.length > 0 ? labels.join("、") : "你对养猫的偏好比较开放";
}

function compactClues(answersSummary: string[]): string {
  return answersSummary
    .filter((line) => /预算|空间|作息|掉毛|陪伴|医疗|室友|家人|清洁/.test(line))
    .slice(0, 3)
    .map((line) => line.replace(/\s+/g, ""))
    .join("; ");
}

function budgetAdvice(premium: PremiumFlags, hard: HardFlags, breed?: BreedProfile): string {
  const budgetSafety = premium.budget_safety;
  const monthlyCost = breed?.monthlyCost;
  if (budgetSafety === "low" || hard.budget === "low") {
    return monthlyCost === "high" || monthlyCost === "mid_high"
      ? "这只猫的长期花费会明显考验预算,建议先准备至少3个月固定养猫预算和单独医疗备用金。"
      : "可以从基础稳定配置开始,但不要把猫粮、猫砂和驱虫压到过低标准。";
  }
  if (budgetSafety === "high" || budgetSafety === "good") {
    return "预算压力不是最大问题,更重要的是别被高价用品带偏,把钱优先放在主粮、体检和医疗备用金上。";
  }
  return "预算处在可计划区间,适合先定月度上限,再决定品种和用品档位。";
}

function housingAdvice(premium: PremiumFlags, hard: HardFlags, breed?: BreedProfile): string {
  if (premium.home_control === "shared" || premium.home_control === "negotiated" || hard.consent === "negotiating") {
    return "你需要先确认室友、家人或房东的许可,并把猫砂盆、抓板和活动范围写成明确方案。";
  }
  if (hard.space === "small" || premium.premium_housing === "shared") {
    return breed?.smallSpaceFit === "low"
      ? "空间会是主要限制,建议优先考虑活动量更低、适应小空间更好的备选猫。"
      : "空间不是不能养,但要把垂直活动区、猫砂盆位置和收纳动线提前设计好。";
  }
  return "居住条件相对稳定,适合做长期规划,重点是保持固定活动区和安静休息区。";
}

function scheduleAdvice(hard: HardFlags, breed?: BreedProfile): string {
  if (hard.care_time === "low" || hard.schedule === "busy" || hard.schedule === "irregular") {
    return breed?.activity === "high" || breed?.clinginess === "high"
      ? "你的时间安排和高互动猫会有拉扯,需要固定每日陪玩窗口,否则猫会用夜间活动提醒你。"
      : "可以选择更独立的相处节奏,但喂食、清洁和陪玩仍要固定到日程里。";
  }
  if (hard.schedule === "night") {
    return "夜间作息不代表不能养,但要提前训练睡前陪玩和固定喂食,减少半夜跑动。";
  }
  return "你的作息相对可控,适合用固定喂食、清洁和陪玩建立猫的安全感。";
}

function medicalAdvice(premium: PremiumFlags, hard: HardFlags, breed?: BreedProfile): string {
  if (premium.premium_medical_buffer === "weak" || hard.medical_buffer === "low") {
    return "现在最需要补的是医疗备用金。建议先把体检、疫苗、驱虫和突发就诊预算单独留出来,再决定接猫时间。";
  }
  if (premium.premium_medical_buffer === "reserved") {
    return "你愿意提前准备医疗备用金,这是很成熟的信号。下一步是确认附近靠谱医院和夜间急诊选择。";
  }
  if (breed?.vetRisk === "high") {
    return "这个品种有更高的健康管理要求,即使你能承受基础医疗,也建议提前做品种风险功课和年度体检计划。";
  }
  return "医疗承受力处在可规划范围内,重点是不要等生病后才第一次了解医院和费用。";
}

function buildConflictText(conflict: BreedConflict | undefined, breedName: string): string {
  if (!conflict?.hasConflict) {
    return "综合判断:目前没有明显硬冲突,但仍要记住,品种只是参考,真实相处还要看具体猫的性格。";
  }
  return `综合判断:你的${conflict.typeLabels.join("、")}和${breedName}存在现实拉扯。建议不是否定这份喜欢,而是先把相关条件补齐;如果想更稳,可以认真看看${conflict.softAlternative ?? "维护压力更低的猫"}。`;
}

function emotionParagraph(premium: PremiumFlags, style: StyleCopy): string {
  const need = premium.emotional_need;
  if (need === "comfort") {
    return `你真正想获得的是被安慰的感觉。猫对你来说不是摆设,而是低谷时能让房间重新有温度的存在。${style.judgement}`;
  }
  if (need === "routine") {
    return `你想要的是一种生活秩序。照顾猫会让你每天有固定动作:添水、清砂、陪玩、观察状态。${style.judgement}`;
  }
  if (need === "playfulness") {
    return `你期待家里多一点活泼感,希望猫能把日常从重复里拉出来。适合你的不是过度消耗精力的热闹,而是能互动也能收住的节奏。${style.judgement}`;
  }
  if (need === "uncertain") {
    return `你还没完全说清为什么想养猫,但这种模糊本身很真实。先用准备清单和线下接触确认自己想要的是陪伴、秩序还是情绪出口。${style.judgement}`;
  }
  return `你最需要的是稳定陪伴:家里有一个生命在自己的节奏里靠近你、等待你。${style.judgement}`;
}

function decisionParagraph(premium: PremiumFlags): string {
  if (premium.decision_goal === "whether_now") {
    return "所以报告最后给你的核心判断是:不要只问想不想养,要问预算、许可、医疗和时间是否已经能连续稳定三个月。";
  }
  if (premium.decision_goal === "which_cat") {
    return "你最该关注的是猫的活动量、粘人度和护理成本,它们比单纯品种名更能决定日后是否舒服。";
  }
  if (premium.decision_goal === "avoid_list") {
    return "你最需要避开的坑是:只看颜值、忽略医疗预算、没有确认同住者态度、用品一次性买太满。";
  }
  if (premium.decision_goal === "prep_list") {
    return "你的重点应该放在准备顺序:先预算和许可,再医院和用品,最后才是看猫和接猫。";
  }
  return "你想理解自己为什么这么想养猫。答案可能是你正在寻找一种稳定、柔软、不会过度消耗你的亲密关系。";
}

function buildRisks(input: LocalReportInput): [string, string, string] {
  const premium = input.premiumFlags;
  const first = riskForMainWorry(premium.main_worry);
  const second = input.conflict?.hasConflict
    ? `匹配风险:${input.conflict.typeLabels.join("、")}已经提示现实拉扯。解决方案:先完成对应准备,再把${input.persona.primaryBreed.name}和${input.conflict.softAlternative ?? "更低维护的猫"}放在同一张表里比较。`
    : "匹配风险:即使结论很顺,也不要把品种当保证。解决方案:看猫时观察亲人度、胆量、食欲和应激反应,不要只看照片。";
  const third = medicalOrRoutineRisk(input);
  return [first, second, third];
}

function riskForMainWorry(worry?: string): string {
  if (worry === "cleaning") {
    return "清洁风险:掉毛、猫砂和气味会持续出现。解决方案:固定猫砂盆位置,选低粉尘猫砂,准备滚毛器和每周清洁节奏。";
  }
  if (worry === "medical") {
    return "医疗风险:猫生病时花费和决策会同时压上来。解决方案:先列附近医院、夜间急诊和基础体检价格,再准备备用金。";
  }
  if (worry === "time") {
    return "时间风险:忙起来容易只剩喂食清砂。解决方案:每天固定两段10分钟互动,比偶尔补偿式陪玩更有效。";
  }
  if (worry === "consent") {
    return "许可风险:家人、室友或房东态度不清会让养猫变成长期拉扯。解决方案:先拿到明确同意,再谈接猫。";
  }
  if (worry === "mismatch") {
    return "性格不合风险:你想象中的猫和真实的猫可能不同。解决方案:优先线下接触,给自己和猫都留试探空间。";
  }
  return "成本风险:长期支出会比第一眼看到的用品价格更重要。解决方案:先做月预算和突发医疗预算,不要把兑换报告当成接猫许可。";
}

function medicalOrRoutineRisk(input: LocalReportInput): string {
  if (input.premiumFlags.premium_medical_buffer === "weak" || input.hardFlags.medical_buffer === "low") {
    return "突发风险:医疗备用金不足时,一次就诊就会变成压力。解决方案:先存一笔专款,没有存够前先继续做功课。";
  }
  if (input.hardFlags.care_time === "low") {
    return "陪伴风险:你可能会低估猫对稳定互动的需要。解决方案:把陪玩和观察状态写进日程,不要只靠周末补。";
  }
  return "新手风险:前一个月最容易因为用品、喂食和清洁节奏慌乱。解决方案:用品少而准,每天记录食欲、排便和精神状态。";
}

function catNamesFor(emotionalNeed?: string): Array<{ name: string; reason: string }> {
  if (emotionalNeed === "comfort") {
    return [
      { name: "小棉", reason: "像一块安静的软垫" },
      { name: "团团", reason: "把低落的日子轻轻团住" },
      { name: "暖灯", reason: "回家时有一点亮" },
    ];
  }
  if (emotionalNeed === "routine") {
    return [
      { name: "小钟", reason: "提醒生活回到节奏" },
      { name: "早早", reason: "把每天从照顾开始" },
      { name: "格子", reason: "适合有秩序的小猫" },
    ];
  }
  if (emotionalNeed === "playfulness") {
    return [
      { name: "跳跳", reason: "带一点轻快的生命力" },
      { name: "咕噜", reason: "有互动也有满足" },
      { name: "豆包", reason: "活泼但不锋利" },
    ];
  }
  return [
    { name: "灯灯", reason: "像家里一直留着的小灯" },
    { name: "小满", reason: "不必太满,刚刚好" },
    { name: "安安", reason: "把陪伴落到安稳里" },
  ];
}

function formatRange(range: [number, number]): string {
  return `${range[0]}-${range[1]}`;
}
