import { describe, expect, it } from "vitest";
import { breedByName, personas, premiumQuestions, questions } from "./content";
import { buildLocalReport, generateLocalReportStream, localReportModelName } from "./local-report";
import { collectPremiumFlags } from "./premium";
import { reportSentenceSimilarity } from "./report-similarity";
import { detectBreedConflict, scoreAnswers } from "./scoring";
import type { HardFlags } from "./types";

const basePremiumAnswers: number[] = premiumQuestions.map((q) => (q.id === "qP6" ? 2 : 0));

function reportFor(premiumAnswers = basePremiumAnswers, sessionId = "test-session") {
  const persona = personas.find((p) => p.id === "velvet_commander") ?? personas[0];
  const hardFlags = {
    budget: "low",
    shedding: "low",
    space: "small",
    care_time: "low",
    schedule: "busy",
    medical_buffer: "low",
    consent: "negotiating",
  };

  return buildLocalReport({
    sessionId,
    persona,
    answersSummary: [
      "你能接受的月预算是？ → 300以内，精打细算",
      "你住在哪里？ → 合租房间",
      "你最担心什么？ → 生病花钱和照顾压力",
    ],
    hardFlags,
    premiumFlags: collectPremiumFlags(premiumAnswers),
    breedFacts: breedByName(persona.primaryBreed.name),
    conflict: detectBreedConflict(persona, hardFlags),
  });
}

function reportForAnswerSet(
  sessionId: string,
  answers: number[],
  premiumAnswers = premiumQuestions.map(() => 0),
) {
  const score = scoreAnswers(answers);
  const persona = personas.find((item) => item.id === score.personaId)!;
  const answersSummary = answers.map((optionIndex, index) => (
    `${questions[index].text} → ${questions[index].options[optionIndex].text}`
  ));

  return buildLocalReport({
    sessionId,
    persona,
    answersSummary,
    hardFlags: score.hardFlags,
    premiumFlags: collectPremiumFlags(premiumAnswers),
    breedFacts: breedByName(persona.primaryBreed.name),
    conflict: detectBreedConflict(persona, score.hardFlags),
  });
}

function reportWithHardFlags(sessionId: string, hardFlags: HardFlags) {
  const persona = personas.find((item) => item.id === "velvet_commander")!;
  return buildLocalReport({
    sessionId,
    persona,
    answersSummary: [],
    hardFlags,
    premiumFlags: collectPremiumFlags(basePremiumAnswers),
    breedFacts: breedByName(persona.primaryBreed.name),
    conflict: detectBreedConflict(persona, hardFlags),
  });
}

describe("本地规则报告生成器", () => {
  it("不依赖外部模型配置,生成六节定制报告", () => {
    const report = reportFor();

    expect(localReportModelName()).toBe("local-rules-v1.4");
    expect(report).toContain("## 你的猫系人格");
    expect(report).toContain("## 现实适配度");
    expect(report).toContain("## 三个养猫风险和解决方案");
    expect(report).toContain("预算：");
    expect(report).toContain("医疗备用金");
    expect(report).toContain("猫名彩蛋");
    expect(report).toContain("领养代替购买");
  });

  it("报告包含人格专属的'被看见'高潮段(情绪锚点)", () => {
    const persona = personas.find((p) => p.id === "velvet_commander") ?? personas[0];
    const report = reportFor();
    // signatureParagraph 必须完整出现,且落在"你的猫系人格"节内(为什么是...之前)
    expect(persona.signatureParagraph.length).toBeGreaterThan(40);
    const personaSection = report.split("## 为什么是")[0];
    expect(personaSection).toContain(persona.signatureParagraph);
  });

  it("每个人格都有非空 signatureParagraph", () => {
    for (const persona of personas) {
      expect(persona.signatureParagraph.length, `${persona.id} 缺少高潮段`).toBeGreaterThan(40);
    }
  });

  it("不同付费答案会生成不同重点", () => {
    const practical = reportFor(basePremiumAnswers);
    const emotionalAnswers = [...basePremiumAnswers];
    emotionalAnswers[2] = 1; // comfort
    emotionalAnswers[4] = 3; // emotional style
    emotionalAnswers[6] = 4; // self understanding
    const emotional = reportFor(emotionalAnswers);

    expect(practical).not.toEqual(emotional);
    expect(practical).toContain("清单");
    expect(emotional).toContain("被安慰");
    expect(emotional).toContain("为什么这么想养猫");
  });

  it("不输出玄学类表达", () => {
    const report = reportFor();
    const blockedWords = ["占" + "卜", "命" + "理", "运" + "势", "算" + "命", "注" + "定", "天" + "命", "玄" + "学"];
    for (const word of blockedWords) {
      expect(report.includes(word), `报告不应包含 ${word}`).toBe(false);
    }
  });

  it("报告不泄漏系统词，不出现双句号，并把空间与居住许可分开", () => {
    const report = reportFor();
    const blockedWords = ["兑换", "会话", "生成", "session"];
    for (const word of blockedWords) {
      expect(report.includes(word), `报告正文不应包含系统词 ${word}`).toBe(false);
    }
    expect(report).not.toContain("。。");
    expect(report).not.toMatch(/[\u4e00-\u9fff][,:;][\u4e00-\u9fff]/);

    const spaceLine = report.split("\n").find((line) => line.startsWith("空间："));
    const consentLine = report.split("\n").find((line) => line.startsWith("居住许可："));
    expect(spaceLine).toBeTruthy();
    expect(spaceLine).not.toContain("许可");
    expect(consentLine).toContain("室友");
  });

  it("流式输出能完整还原报告", async () => {
    const persona = personas[0];
    const input = {
      sessionId: "stream-session",
      persona,
      answersSummary: [],
      hardFlags: { budget: "mid" },
      premiumFlags: collectPremiumFlags(basePremiumAnswers),
      breedFacts: breedByName(persona.primaryBreed.name),
      conflict: detectBreedConflict(persona, { budget: "mid" }),
    };
    let streamed = "";
    for await (const chunk of generateLocalReportStream(input)) {
      streamed += chunk;
    }

    expect(streamed).toBe(buildLocalReport(input));
  });

  it("同一会话刷新稳定，不同会话会选择不同报告变体", () => {
    const first = reportFor(basePremiumAnswers, "variant-session-a");
    const repeated = reportFor(basePremiumAnswers, "variant-session-a");
    const second = reportFor(basePremiumAnswers, "variant-session-b");

    expect(repeated).toBe(first);
    expect(second).not.toBe(first);
  });

  it("把用户选项原文分散织入至少两处，不再输出箭头问答对", () => {
    const answers = [0, 3, 0, 1, 1, 1, 2, 1, 0, 0, 3, 1, 3, 3, 2, 3];
    const report = reportForAnswerSet("weave-session", answers);
    const selectedTexts = answers.map((optionIndex, index) => questions[index].options[optionIndex].text);
    const wovenCount = selectedTexts.filter((text) => report.includes(text)).length;

    expect(wovenCount).toBeGreaterThanOrEqual(2);
    expect(report).not.toContain("→");
    expect(report).not.toContain("从基础题看，你身上的线索是");
  });

  it("包含三品种真实对比、品种专属用品和人格收尾判词", () => {
    const report = reportFor(basePremiumAnswers, "comparison-session");
    expect(report).toContain("在你最在意的几个维度上，把三只放在一起看");
    expect(report).toContain("月花费(主粮+猫砂+护理合计)");
    expect(report).toContain("为缅因猫多准备");
    expect([
      "照顾了所有人的你，是时候被一只猫接管了。",
      "你的秩序里，该给'被依赖'留一个位置。",
      "这一次，换它来查你的岗。",
    ].some((line) => report.includes(line))).toBe(true);
  });

  it("横向对比维度随 hard_flags 变化，花费数据来自品种事实库", () => {
    const budgetReport = reportWithHardFlags("dimension-session", { budget: "low" });
    const spaceReport = reportWithHardFlags("dimension-session", { space: "small" });
    const maine = breedByName("缅因猫")!;
    const expectedMinimum = maine.costDetail.food[0] + maine.costDetail.litter[0] + maine.costDetail.other[0];
    const expectedMaximum = maine.costDetail.food[1] + maine.costDetail.litter[1] + maine.costDetail.other[1];

    expect(budgetReport).toContain(`缅因猫${expectedMinimum}-${expectedMaximum}元`);
    expect(budgetReport).not.toContain("小空间适配：");
    expect(spaceReport).toContain("小空间适配：");
    expect(spaceReport).not.toContain("粘人程度：");
  });

  it("主推品种国内可获得性为 mid 时给出稀缺提示", () => {
    const persona = personas[0];
    const breed = breedByName(persona.primaryBreed.name)!;
    const report = buildLocalReport({
      sessionId: "availability-session",
      persona,
      answersSummary: [],
      hardFlags: {},
      premiumFlags: collectPremiumFlags(basePremiumAnswers),
      breedFacts: { ...breed, availability: "mid" },
      conflict: detectBreedConflict(persona, {}),
    });
    expect(report).toContain("说句实在的：这只在国内不算常见，如果缘分一时难寻，下面的备选同样契合，不必执着。");
  });

  it("闺蜜同人格同语气报告的完全相同句子占比不超过35%", () => {
    const answersA = [0, 3, 0, 1, 1, 1, 2, 1, 0, 0, 3, 1, 3, 3, 2, 3];
    const answersB = [2, 3, 0, 3, 0, 2, 2, 2, 0, 0, 3, 3, 1, 3, 2, 3];
    expect(scoreAnswers(answersA).personaId).toBe("dusk_weaver");
    expect(scoreAnswers(answersB).personaId).toBe("dusk_weaver");

    const first = reportForAnswerSet(
      "c0b66202-3383-4f3d-86a5-ce0fe22625be",
      answersA,
      [0, 0, 1, 2, 0, 1, 0],
    );
    const second = reportForAnswerSet(
      "5b92f84a-4344-465d-a12d-04bffdae452c",
      answersB,
      [3, 3, 3, 1, 0, 4, 4],
    );
    const persona = personas.find((item) => item.id === "dusk_weaver")!;
    const similarity = reportSentenceSimilarity(first, second, {
      reasonableRepeatLines: [persona.signatureParagraph, persona.primaryBreed.reason],
      reasonableRepeatPrefixes: persona.altBreeds.map((item) => `${item.name}：`),
    });
    expect(similarity.variableRatio).toBeLessThanOrEqual(0.35);
  });

  it("F5 多冲突只深说一次，给出缓一缓建议且不否决", () => {
    const answers = [2, 3, 3, 1, 0, 0, 3, 2, 0, 2, 3, 3, 2, 0, 3, 1];
    const score = scoreAnswers(answers);
    const persona = personas.find((item) => item.id === score.personaId)!;
    const conflict = detectBreedConflict(persona, score.hardFlags);
    const report = reportForAnswerSet("multi-conflict-session", answers);

    expect(score.personaId).toBe("velvet_commander");
    expect(persona.primaryBreed.name).toBe("缅因猫");
    expect(conflict.typeLabels).toHaveLength(2);
    expect(report.match(/综合判断/g)).toHaveLength(2);
    expect(report.match(new RegExp(conflict.typeLabels.join("、"), "g"))).toHaveLength(1);
    expect(report).toContain("上面综合判断里提到的两件事");
    expect(report).toContain("先缓一缓比冲动开始更负责");
    expect(report).not.toMatch(/你不能养|不适合养|不建议养|不该养/);
  });

  it("F6 报告标点、系统词与空间/许可分行符合要求", () => {
    const report = reportWithHardFlags("punctuation-session", {
      space: "small",
      consent: "negotiating",
      budget: "low",
    });
    expect(report).not.toContain("。。");
    expect(report).not.toMatch(/[\u3400-\u9fff）】》」』”’][,:;?!]/);
    expect(report).not.toMatch(/兑换|会话|生成|session/i);

    const spaceLine = report.split("\n").find((line) => line.startsWith("空间："));
    const consentLine = report.split("\n").find((line) => line.startsWith("居住许可："));
    expect(spaceLine).toBeTruthy();
    expect(spaceLine).not.toContain("许可");
    expect(consentLine).toBeTruthy();
  });

  it("同一情绪需求可按会话轮换至少三组猫名", () => {
    const nameLines = new Set<string>();
    for (let index = 0; index < 60; index += 1) {
      const report = reportFor(basePremiumAnswers, `cat-name-session-${index}`);
      const line = report.split("\n").find((item) => item.startsWith("猫名彩蛋："));
      if (line) nameLines.add(line);
    }
    expect(nameLines.size).toBeGreaterThanOrEqual(3);
  });

  it("同一人格可按会话轮换三条收尾判词", () => {
    const verdicts = new Set<string>();
    for (let index = 0; index < 60; index += 1) {
      const report = reportFor(basePremiumAnswers, `closing-session-${index}`);
      const lines = report.split("\n").map((line) => line.trim()).filter(Boolean);
      const disclaimerIndex = lines.findIndex((line) => line.startsWith("倡导领养代替购买"));
      verdicts.add(lines[disclaimerIndex - 1]);
    }
    expect(verdicts.size).toBe(3);
  });

  it("两个新增人格可完整生成报告和专属收尾", () => {
    for (const personaId of ["quiet_director", "wild_artist"]) {
      const persona = personas.find((item) => item.id === personaId)!;
      const report = buildLocalReport({
        sessionId: `new-persona-${personaId}`,
        persona,
        answersSummary: [],
        hardFlags: {},
        premiumFlags: collectPremiumFlags(basePremiumAnswers),
        breedFacts: breedByName(persona.primaryBreed.name),
        conflict: detectBreedConflict(persona, {}),
      });
      expect(report).toContain(`你的测试结果是「${persona.title}」`);
      expect(report).toContain(`## 为什么是${persona.primaryBreed.name}`);
      expect(report).toContain("倡导领养代替购买");
    }
  });
});
