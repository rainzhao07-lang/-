import { describe, expect, it } from "vitest";
import { breedByName, personas, premiumQuestions } from "./content";
import { buildLocalReport, generateLocalReportStream, localReportModelName } from "./local-report";
import { collectPremiumFlags } from "./premium";
import { detectBreedConflict } from "./scoring";

const basePremiumAnswers: number[] = premiumQuestions.map((q) => (q.id === "qP6" ? 2 : 0));

function reportFor(premiumAnswers = basePremiumAnswers) {
  const persona = personas.find((p) => p.id === "velvet_commander") ?? personas[0];
  const hardFlags = {
    budget: "low",
    shedding: "low",
    space: "small",
    care_time: "low",
    schedule: "busy",
    medical_buffer: "low",
  };

  return buildLocalReport({
    sessionId: "test-session",
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

describe("本地规则报告生成器", () => {
  it("不依赖外部模型配置,生成六节定制报告", () => {
    const report = reportFor();

    expect(localReportModelName()).toBe("local-rules-v1");
    expect(report).toContain("## 你的猫系人格");
    expect(report).toContain("## 现实适配度");
    expect(report).toContain("## 三个养猫风险和解决方案");
    expect(report).toContain("预算:");
    expect(report).toContain("医疗备用金");
    expect(report).toContain("猫名彩蛋");
    expect(report).toContain("领养代替购买");
  });

  it("不同付费答案会生成不同重点", () => {
    const practical = reportFor(basePremiumAnswers);
    const emotionalAnswers = [...basePremiumAnswers];
    emotionalAnswers[3] = 1; // comfort
    emotionalAnswers[5] = 3; // emotional style
    emotionalAnswers[7] = 4; // self understanding
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
});
