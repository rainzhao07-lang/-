// 报告生成 Prompt 模板。
// 运营者可直接改这里的措辞调优报告文风,不需要碰任何组件代码。
import { describePremiumFlags } from "@/lib/premium";
import type { BreedConflict, BreedProfile, HardFlags, Persona, PremiumFlags } from "@/lib/types";

/** 硬条件标记 → 给 LLM 看的人话描述 */
export const HARD_FLAG_LABELS: Record<string, Record<string, string>> = {
  schedule: {
    regular: "作息规律,23点前入睡",
    normal: "0-1点入睡,普通程度的晚",
    night: "深夜型,凌晨2点后入睡是常态",
    irregular: "轮班/出差,作息不固定",
    busy: "工作学习繁忙,常加班到深夜",
  },
  space: {
    small: "居住在合租房的一间,空间有限",
    medium: "独立小户型",
    large: "两室以上或带阳台/院子,空间宽裕",
  },
  budget: {
    low: "月均养猫预算300元以内",
    mid: "月均养猫预算300-800元",
    high: "月均养猫预算800元以上",
  },
  shedding: {
    low: "完全不能接受掉毛,有洁癖",
    mid: "可接受少量掉毛,愿意定期打理",
    high: "对掉毛完全无所谓",
  },
  clinginess: {
    want_high: "希望猫非常黏人,走哪跟哪",
    want_low: "希望彼此独立,偶尔亲近",
    want_play: "希望互动性强,能一起玩",
    flexible: "对亲密度顺其自然",
  },
  household: {
    alone: "独居",
    partner: "与伴侣同住",
    roommates: "与室友合租",
    family: "与家人同住,家中可能有小孩或老人",
  },
  care_time: {
    low: "下班后需要先恢复精力,稳定陪伴时间偏少",
    mid: "能保持日常轻量互动,也需要各自空间",
    high: "愿意下班后主动陪玩和互动",
  },
  consent: {
    clear: "居住环境由自己决定,养猫许可明确",
    discussed: "已和家人或室友沟通过,基本同意",
    negotiating: "仍在争取家人或室友支持",
    blocked: "可能存在家人、室友或居住规则反对",
  },
  medical_buffer: {
    high: "突发医疗开销承受力较强",
    mid: "可以安排基础和突发医疗支出",
    tight: "面对突发医疗支出会谨慎权衡",
    low: "当前较难承受突发医疗开销",
  },
  allergy: {
    none: "对猫毛和粉尘基本无明显反应",
    mild: "偶尔喷嚏,但不太影响生活",
    sensitive: "有鼻炎或过敏体质,需要谨慎",
    unknown: "尚未确认自己与猫长期相处后的过敏反应",
  },
  trouble: {
    all_ok: "能接受掉毛、夜间活动、抓挠和吐毛球等真实麻烦",
    cleaning: "最担心掉毛和清洁压力",
    night_noise: "最担心猫夜里跑酷或吵闹",
    medical_worry: "最担心生病花钱和照顾压力",
  },
  experience: {
    newbie: "第一次认真考虑养猫,仍在做功课",
    familiar: "家里曾经养过猫,知道养猫不是玩具",
    researched: "长期云吸猫并主动收藏攻略",
    experienced: "有养猫或照顾猫的实际经验",
  },
};

export function describeHardFlags(flags: HardFlags): string[] {
  return Object.entries(flags).map(
    ([key, value]) => HARD_FLAG_LABELS[key]?.[value] ?? `${key}: ${value}`,
  );
}

export type ReportMessages = { system: string; user: string };

/**
 * 组装报告生成消息。
 * 安全边界:answersSummary 由服务端从题库文本拼装(用户只提交选项下标),
 * 全链路没有任何用户自由文本,天然免疫 Prompt 注入——保持这一点。
 */
export function buildReportMessages(
  persona: Persona,
  answersSummary: string[],
  hardFlags: HardFlags,
  breedFacts?: BreedProfile,
  conflict?: BreedConflict,
  premiumFlags?: PremiumFlags,
): ReportMessages {
  const costLine = breedFacts
    ? `${breedFacts.name}参考月花费:主粮${formatRange(breedFacts.costDetail.food)}元,猫砂${formatRange(breedFacts.costDetail.litter)}元,其他护理/玩具/零食${formatRange(breedFacts.costDetail.other)}元。`
    : "品种事实库暂缺,请只给保守参考区间。";
  const healthLine = breedFacts
    ? `${breedFacts.name}健康与护理重点:${breedFacts.healthRisks.join(";")}。`
    : "健康与护理重点需用保守常识表达,避免绝对化。";
  const conflictLine =
    conflict?.hasConflict
      ? `现实适配提示:用户的${conflict.typeLabels.join("、")}与${conflict.primaryBreed}存在冲突。报告必须写一段建设性的\"缓一缓\"建议,方向是:以现在的条件养${conflict.primaryBreed}会有点吃力,但不是否定用户;如果先把相关条件安排好,或从${conflict.softAlternative ?? "更低维护的猫"}开始,会顺利得多。`
      : "现实适配提示:未发现明显冲突,但仍需提醒用户每只猫都是独立个体。";
  const premiumLines = describePremiumFlags(premiumFlags);
  const hasPremium = premiumLines.length > 0;
  const styleRule = reportStyleRule(premiumFlags?.report_style);
  const structureLines = hasPremium
    ? [
        "【结构要求】用 Markdown 小标题(## 开头)分为六节,顺序固定:",
        "1. 「你的猫系人格」——对用户人格的深度剖析,其中必须有一段直击内心、让用户感觉\"被看见\"的句子;",
        `2. 「为什么是${persona.primaryBreed.name}」——结合用户的具体答案,把这只猫拟人化地写活;`,
        "3. 「现实适配度」——必须分开写预算、空间、作息、医疗承受力,并给出清晰判断;",
        "4. 「情绪需求」——解释用户真正想从猫身上获得什么,不要只写陪伴两个字;",
        "5. 「三个养猫风险和解决方案」——每个风险都要给可执行方案,不要制造焦虑;",
        "6. 「备选与行动清单」——写两只备选猫、新手第一个月准备清单、3个 AI 猫名彩蛋。",
      ]
    : [
        "【结构要求】用 Markdown 小标题(## 开头)分为五节,顺序固定:",
        "1. 「你的猫系人格」——对用户人格的深度剖析,其中必须有一段直击内心、让用户感觉\"被看见\"的句子;",
        `2. 「为什么是${persona.primaryBreed.name}」——结合用户的具体答案,把这只猫拟人化地写活;`,
        `3. 「两只备选」——${persona.altBreeds.map((b) => b.name).join("与")},与主推品种做诚实的横向对比;`,
        `4. 「真实养育须知」——${persona.primaryBreed.name}的性格真相、健康注意点、月均花费分项、新手第一个月清单;`,
        "5. 「彩蛋」——为这只未来的猫起3个有寓意的名字,每个附一句解释。",
      ];

  const system = [
    "你是「本命猫鉴定所」的首席猫格鉴定师:温暖、专业、有文采,用中文写作。",
    "你的任务是基于用户的测试结果,写一份900-1200字的《养猫决策报告》。",
    "",
    ...structureLines,
    "",
    "【语气规则】",
    `- ${styleRule}`,
    "- 缺点要写成\"代价与美感\",永远不贬损用户;",
    "- 付费定制信息必须显著影响报告,尤其是预算、医疗、居住状态、情绪需求、担心点和最终判断目标;",
    "- 所有品种描述必须优先依据下方【品种事实库】,不要编造未给出的遗传病或绝对结论;",
    "- 花费必须写成分项参考区间,禁止只写\"数百元区间\"、\"丰俭由人\"、\"因人而异\"这类空话;",
    "- 用户的硬性条件(作息/空间/预算/掉毛底线等)不改变人格结论,但必须诚实地影响建议:",
    "  条件与品种存在冲突时(例如不能接受掉毛但主推品种掉毛明显),要直说现实并给出可操作的应对方案。",
    "- 冲突表达只做建设性的\"缓一缓\"建议,不要写\"你不适合养猫\"、\"暂不建议养猫\"这类否决式结论。",
    "",
    "【禁词(硬规则)】全文严禁出现:占卜、命理、运势、算命、注定、天命、玄学。表达缘分感请用「契合」「匹配」。",
    "",
    "【固定结尾】报告最后必须依次包含以下两层意思(可润色但不可省略):",
    "1. 倡导领养代替购买,并说明这些性格特质在田园猫中同样存在;",
    "2. 温和免责:本报告为参考建议,每只猫都是独立的个体。",
  ].join("\n");

  const user = [
    "以下是这位用户的测试结果,请为TA写报告。",
    "",
    `【人格结果】${persona.title}(${persona.subtitle})`,
    `【判词】${persona.verdict}`,
    `【主推品种】${persona.primaryBreed.name} —— ${persona.primaryBreed.reason}`,
    `【备选品种】${persona.altBreeds.map((b) => `${b.name}(${b.reason})`).join(";")}`,
    "",
    "【品种事实库】",
    `- ${costLine}`,
    `- ${healthLine}`,
    breedFacts
      ? `- 适配标签:掉毛${breedFacts.shedding},活动量${breedFacts.activity},粘人度${breedFacts.clinginess},打理成本${breedFacts.grooming},新手友好度${breedFacts.beginnerFit},小空间适配${breedFacts.smallSpaceFit},国内可获得性${breedFacts.availability}。`
      : "- 适配标签暂缺。",
    "",
    "【现实适配提示】",
    `- ${conflictLine}`,
    "",
    "【用户的答题记录】",
    ...answersSummary.map((line) => `- ${line}`),
    "",
    "【用户的硬性条件】",
    ...describeHardFlags(hardFlags).map((line) => `- ${line}`),
    ...(premiumLines.length > 0
      ? [
          "",
          "【付费定制信息】",
          ...premiumLines.map((line) => `- ${line}`),
        ]
      : []),
  ].join("\n");

  return { system, user };
}

function formatRange(range: [number, number]): string {
  return `${range[0]}-${range[1]}`;
}

function reportStyleRule(style?: string): string {
  if (style === "direct") {
    return "用户选择了直接风格:少铺垫,把关键判断、风险和下一步说清楚。";
  }
  if (style === "practical") {
    return "用户选择了实用风格:多用清单、判断标准和可执行步骤,少写空泛抒情。";
  }
  if (style === "emotional") {
    return "用户选择了情绪共鸣风格:可以更有画面感,但现实风险仍要具体。";
  }
  return "用户选择了温柔风格或未指定风格:表达要柔和,但不能回避现实判断。";
}
