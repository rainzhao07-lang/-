import { describe, expect, it } from "vitest";
import { premiumQuestions } from "./content";
import {
  canAccessPremiumCard,
  canGeneratePaidReport,
  collectPremiumFlags,
  describePremiumFlags,
  validatePremiumAnswers,
} from "./premium";

const VALID_ANSWERS = premiumQuestions.map((q) => (q.id === "qP6" ? 2 : 0));

describe("付费定制题数据", () => {
  it("共7题且不再询问收入,每题有选项、value 和 flags", () => {
    expect(premiumQuestions).toHaveLength(7);
    expect(premiumQuestions.some((question) => question.id === "qP1")).toBe(false);
    expect(JSON.stringify(premiumQuestions)).not.toContain("income");
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
    const flags = collectPremiumFlags([1, 2, 3, 4, 2, 3, 4]);
    expect(flags.income_band).toBeUndefined();
    expect(flags.spending_margin).toBeUndefined();
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
    expect(validatePremiumAnswers("qP2=A")).toBe(false);
  });

  it("汇总标签后可转成人话描述", () => {
    const flags = collectPremiumFlags(VALID_ANSWERS);
    const lines = describePremiumFlags(flags);
    expect(lines.join("\n")).not.toContain("收入");
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
