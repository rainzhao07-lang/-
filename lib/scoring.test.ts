import { describe, expect, it } from "vitest";
import { breeds, breedByName, personas, questions } from "./content";
import {
  accumulateScores,
  collectFlags,
  detectBreedConflict,
  pickTopPersona,
  scoreAnswers,
  validateAnswers,
} from "./scoring";

const ALL_FIRST = questions.map(() => 0); // 每题都选第一个选项
const ALL_SECOND = questions.map(() => 1);

describe("数据文件完整性", () => {
  it("V1.4 包含10种人格和两个新增人格", () => {
    expect(personas).toHaveLength(10);
    expect(personas.find((persona) => persona.id === "quiet_director")).toMatchObject({
      title: "不动声色的主理人",
      primaryBreed: { name: "田园三花猫" },
    });
    expect(personas.find((persona) => persona.id === "wild_artist")).toMatchObject({
      title: "失控的小艺术家",
      primaryBreed: { name: "田园奶牛猫" },
    });
  });

  it("共16题,每题至少3个选项", () => {
    expect(questions).toHaveLength(16);
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

  it("V1.4 品种与人格内容修订完整", () => {
    const dusk = personas.find((persona) => persona.id === "dusk_weaver")!;
    expect(dusk.primaryBreed).toEqual({
      name: "英国长毛猫",
      reason: "毛茸茸的慢性子，把'陪着你'这件事做到极致——而且比看起来更好养，是治愈系里的务实之选。",
    });
    expect(dusk.altBreeds[0]).toEqual({
      name: "异国短毛猫",
      reason: "一张自带治愈力的脸，慢吞吞、软乎乎——但它的扁脸可爱也脆弱：泪痕、呼吸道需要终身细心，选它等于选一份更重的照顾承诺。",
    });

    const keeper = personas.find((persona) => persona.id === "harbor_keeper")!;
    expect(keeper.title).toBe("静海守灯人");
    expect(keeper.altBreeds[0]).toEqual({
      name: "英短蓝猫",
      reason: "沉稳的蓝灰色绅士，数量多、好相处，是守望者的现实之选。",
    });
    expect(breedByName("英短蓝猫")).toEqual({
      ...breedByName("英国短毛猫")!,
      name: "英短蓝猫",
    });

    const dawn = personas.find((persona) => persona.id === "dawn_expeditioner")!;
    expect(dawn.altBreeds[0].reason).toBe("把每一天过成探险片的顶配玩家——但它需要大量运动与经验，适合已经确定自己精力过剩的你。");
    expect(personas.some((persona) => persona.title === "深港守灯人")).toBe(false);
  });

  it("breeds.json 覆盖所有主推与备选品种,且主推品种不能是低可获得性", () => {
    expect(Object.keys(breeds).length).toBeGreaterThan(0);
    for (const p of personas) {
      const primary = breedByName(p.primaryBreed.name);
      expect(primary, `${p.id} 主推品种缺少事实库:${p.primaryBreed.name}`).toBeDefined();
      expect(primary?.availability, `${p.id} 主推品种国内可获得性过低`).not.toBe("low");
      expect(primary?.starterKit?.length, `${p.id} 主推品种缺少 starterKit`).toBeGreaterThan(0);

      for (const alt of p.altBreeds) {
        const alternative = breedByName(alt.name);
        expect(alternative, `${p.id} 备选品种缺少事实库:${alt.name}`).toBeDefined();
        expect(alternative?.starterKit?.length, `${p.id} 备选品种缺少 starterKit:${alt.name}`).toBeGreaterThan(0);
      }
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
    expect(r1.personaId).toBe("quiet_director");
    expect(r1).toEqual(r2);

    const r3 = scoreAnswers(ALL_SECOND);
    expect(r3.personaId).toBe("harbor_keeper");
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
      care_time: "low",
      schedule: "regular", // q1A 无 flag,q5A regular
      space: "small",
      consent: "clear",
      shedding: "low",
      clinginess: "want_high",
      budget: "high",
      medical_buffer: "high",
      household: "alone",
      allergy: "none",
      trouble: "all_ok",
      experience: "newbie",
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

  it("现实条件冲突会给出温柔备选,无冲突则不提示", () => {
    const commander = personas.find((p) => p.id === "velvet_commander")!;
    const conflict = detectBreedConflict(commander, {
      budget: "low",
      shedding: "low",
      space: "small",
    });
    expect(conflict.hasConflict).toBe(true);
    expect(conflict.types).toEqual(["budget", "space"]);
    expect(conflict.softAlternative).toBe("田园橘猫");
    expect(conflict.message).toContain("现实里更稳的搭档");

    const observer = personas.find((p) => p.id === "city_observer")!;
    const ok = detectBreedConflict(observer, {
      budget: "mid",
      shedding: "mid",
      space: "medium",
    });
    expect(ok.hasConflict).toBe(false);
    expect(ok.message).toBeUndefined();
  });

  it("多重现实冲突只向用户展示优先级最高的两个维度", () => {
    const commander = personas.find((p) => p.id === "velvet_commander")!;
    const conflict = detectBreedConflict(commander, {
      consent: "blocked",
      medical_buffer: "low",
      budget: "low",
      space: "small",
      shedding: "low",
      allergy: "sensitive",
    });

    expect(conflict.types).toEqual(["consent", "medical"]);
    expect(conflict.typeLabels).toHaveLength(2);
  });
});
