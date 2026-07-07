import { describe, expect, it } from "vitest";
import { buildReportMessages } from "@/content/prompts";
import { breedByName, personas, premiumQuestions } from "./content";
import {
  canAccessPremiumCard,
  canGeneratePaidReport,
  collectPremiumFlags,
  describePremiumFlags,
  validatePremiumAnswers,
} from "./premium";

const VALID_ANSWERS = premiumQuestions.map((q) => (q.id === "qP6" ? 2 : 0));

describe("付费定制题数据", () => {
  it("共8题,每题有选项、value 和 flags", () => {
    expect(premiumQuestions).toHaveLength(8);
    for (const q of premiumQuestions) {
      expect(q.id).toMatch(/^qP\d+$/);
      expect(q.text.length).toBeGreaterThan(0);
      expect(q.options.length).toBeGreaterThanOrEqual(4);
      for (const opt of q.options) {
        expect(opt.text.length).toBeGreaterThan(0);
        expect(opt.value.length).toBeGreaterThan(0);
        expect(Object.keys(opt.flags).length).toBeGreaterThan(0);
      }
    }
  });

  it("覆盖付费报告必需的核心标签", () => {
    const flags = collectPremiumFlags([0, 1, 2, 3, 4, 2, 3, 4]);
    expect(flags.income_band).toBe("private");
    expect(flags.monthly_cat_budget).toBe("300_600");
    expect(flags.premium_medical_buffer).toBe("strong");
    expect(flags.emotional_need).toBe("playfulness");
    expect(flags.main_worry).toBe("consent");
    expect(flags.report_style).toBe("practical");
    expect(flags.premium_housing).toBe("family_partner");
    expect(flags.decision_goal).toBe("self_understanding");
  });
});

describe("付费定制答案校验", () => {
  it("只接受完整合法的选项下标数组", () => {
    expect(validatePremiumAnswers(VALID_ANSWERS)).toBe(true);
    expect(validatePremiumAnswers(VALID_ANSWERS.slice(0, 3))).toBe(false);
    expect(validatePremiumAnswers(premiumQuestions.map(() => 99))).toBe(false);
    expect(validatePremiumAnswers("qP1=A")).toBe(false);
  });

  it("汇总标签后可转成人话描述", () => {
    const flags = collectPremiumFlags(VALID_ANSWERS);
    const lines = describePremiumFlags(flags);
    expect(lines.join("\n")).toContain("不想透露可支配收入");
    expect(lines.join("\n")).toContain("报告语气偏实用");
  });
});

describe("付费访问条件", () => {
  const flags = collectPremiumFlags(VALID_ANSWERS);

  it("paid session 缺 premium flags 时不能生成报告", () => {
    expect(canGeneratePaidReport({ paid: true, premiumFlags: null })).toBe(false);
  });

  it("paid session 有 premium flags 时可以生成报告和高级卡", () => {
    expect(canGeneratePaidReport({ paid: true, premiumFlags: flags })).toBe(true);
    expect(canAccessPremiumCard({ paid: true, premiumFlags: flags })).toBe(true);
  });

  it("免费用户不能访问高级报告或高级卡", () => {
    expect(canGeneratePaidReport({ paid: false, premiumFlags: flags })).toBe(false);
    expect(canAccessPremiumCard({ paid: false, premiumFlags: flags })).toBe(false);
  });
});

describe("付费报告 Prompt", () => {
  it("注入 premium flags,并按用户选择调整报告风格", () => {
    const persona = personas[0];
    const breedFacts = breedByName(persona.primaryBreed.name)!;
    const flags = collectPremiumFlags(VALID_ANSWERS);
    const messages = buildReportMessages(
      persona,
      ["预算题 → 300-600 元"],
      { budget: "mid" },
      breedFacts,
      undefined,
      flags,
    );

    expect(messages.system).toContain("分为六节");
    expect(messages.system).toContain("用户选择了实用风格");
    expect(messages.user).toContain("【付费定制信息】");
    expect(messages.user).toContain("报告结尾要重点回答准备度");
  });
});
