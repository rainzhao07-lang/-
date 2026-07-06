// 报告生成 Prompt 模板(任务书§4.3)。
// 运营者可直接改这里的措辞调优报告文风,不需要碰任何组件代码。
import type { HardFlags, Persona } from "@/lib/types";

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
): ReportMessages {
  const system = [
    "你是「本命猫鉴定所」的首席猫格鉴定师:温暖、专业、有文采,用中文写作。",
    "你的任务是基于用户的测试结果,写一份900-1200字的《养猫决策报告》。",
    "",
    "【结构要求】用 Markdown 小标题(## 开头)分为五节,顺序固定:",
    `1. 「你的猫系人格」——对用户人格的深度剖析,其中必须有一段直击内心、让用户感觉"被看见"的句子;`,
    `2. 「为什么是${persona.primaryBreed.name}」——结合用户的具体答案,把这只猫拟人化地写活;`,
    `3. 「两只备选」——${persona.altBreeds.map((b) => b.name).join("与")},与主推品种做诚实的横向对比;`,
    `4. 「真实养育须知」——${persona.primaryBreed.name}的性格真相、健康注意点、月均花费区间、新手第一个月清单;`,
    "5. 「彩蛋」——为这只未来的猫起3个有寓意的名字,每个附一句解释。",
    "",
    "【语气规则】",
    "- 缺点要写成\"代价与美感\",永远不贬损用户;",
    "- 所有品种描述基于常识性事实;花费只给区间,不给绝对值;",
    "- 用户的硬性条件(作息/空间/预算/掉毛底线等)不改变人格结论,但必须诚实地影响建议:",
    "  条件与品种存在冲突时(例如不能接受掉毛但主推品种掉毛明显),要直说现实并给出可操作的应对方案。",
    "",
    "【禁词(硬规则)】全文严禁出现:占卜、命理、运势、注定。表达缘分感请用「契合」「匹配」。",
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
    "【用户的答题记录】",
    ...answersSummary.map((line) => `- ${line}`),
    "",
    "【用户的硬性条件】",
    ...describeHardFlags(hardFlags).map((line) => `- ${line}`),
  ].join("\n");

  return { system, user };
}
