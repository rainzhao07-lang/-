import { describe, expect, it } from "vitest";
import { personas, questions } from "./content";
import {
  accumulateScores,
  collectFlags,
  pickTopPersona,
  scoreAnswers,
  validateAnswers,
} from "./scoring";

const ALL_FIRST = questions.map(() => 0); // 每题都选第一个选项
const ALL_SECOND = questions.map(() => 1);

describe("数据文件完整性", () => {
  it("共12题,每题至少3个选项", () => {
    expect(questions).toHaveLength(12);
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("所有 weights 指向的 persona id 都真实存在", () => {
    const ids = new Set(personas.map((p) => p.id));
    for (const q of questions) {
      for (const opt of q.options) {
        for (const pid of Object.keys(opt.weights)) {
          expect(ids.has(pid), `${q.id} 引用了不存在的 persona: ${pid}`).toBe(true);
        }
      }
    }
  });

  it("每个 persona 结构完整(判词/主推品种/2个备选/微反馈语料/卡片配色)", () => {
    for (const p of personas) {
      expect(p.verdict.length).toBeGreaterThan(0);
      expect(p.freeTeaser.length).toBeGreaterThan(0);
      expect(p.primaryBreed.name.length).toBeGreaterThan(0);
      expect(p.altBreeds).toHaveLength(2);
      expect(p.microFeedbackPool.length).toBeGreaterThanOrEqual(2);
      expect(p.cardTheme.bg).toMatch(/^#/);
      expect(p.cardTheme.accent).toMatch(/^#/);
    }
  });

  it("每个 persona 都能通过某种答案组合胜出(无死人格)", () => {
    // 贪心构造:每题选对该 persona 加分最多的选项
    for (const p of personas) {
      const answers = questions.map((q) => {
        let best = 0;
        let bestW = -1;
        q.options.forEach((opt, i) => {
          const w = opt.weights[p.id] ?? 0;
          if (w > bestW) {
            bestW = w;
            best = i;
          }
        });
        return best;
      });
      const result = scoreAnswers(answers);
      expect(result.personaId, `persona ${p.id} 无法胜出`).toBe(p.id);
    }
  });
});

describe("计分引擎", () => {
  it("固定答案组合 → 稳定得到同一 persona(确定性验收)", () => {
    const r1 = scoreAnswers(ALL_FIRST);
    const r2 = scoreAnswers(ALL_FIRST);
    expect(r1.personaId).toBe("snow_hermit");
    expect(r1).toEqual(r2);

    const r3 = scoreAnswers(ALL_SECOND);
    expect(r3.personaId).toBe("city_observer");
  });

  it("平分时按 personas.json 顺序取先者", () => {
    expect(pickTopPersona({ a: 5, b: 5 }, ["a", "b"])).toBe("a");
    expect(pickTopPersona({ a: 5, b: 5 }, ["b", "a"])).toBe("b");
    // 全零(理论上不会发生)也回落到第一个,保证永远有结果
    expect(pickTopPersona({}, ["x", "y"])).toBe("x");
  });

  it("汇总硬条件标记;同名 key 后答的覆盖先答的", () => {
    const flags = collectFlags(ALL_FIRST);
    expect(flags).toEqual({
      schedule: "regular", // q1A 无 flag,q5A regular
      space: "small",
      shedding: "low",
      clinginess: "want_high",
      budget: "low",
      household: "alone",
    });

    // q1 选 D(schedule: busy),q5 选 C(schedule: night) → 以 q5 为准
    const overwrite = [...ALL_FIRST];
    overwrite[0] = 3;
    overwrite[4] = 2;
    expect(collectFlags(overwrite).schedule).toBe("night");
  });

  it("部分答案也能累加得分(微反馈用)", () => {
    const scores = accumulateScores([0, 0]);
    expect(scores.snow_hermit).toBe(4); // q1A 3 + q2A 1
    expect(scores.harbor_keeper).toBe(3); // q2A 3
  });

  it("非法输入抛错", () => {
    expect(validateAnswers([0, 1])).toBe(false); // 长度不够
    expect(validateAnswers(questions.map(() => 99))).toBe(false); // 下标越界
    expect(validateAnswers("not-an-array")).toBe(false);
    expect(() => scoreAnswers([0])).toThrow("INVALID_ANSWERS");
  });
});
