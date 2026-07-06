// 全局领域类型:内容数据(/content)与计分引擎共用
export type Breed = { name: string; reason: string };

export type Persona = {
  id: string;
  title: string;
  subtitle: string;
  verdict: string;
  freeTeaser: string;
  primaryBreed: Breed;
  altBreeds: Breed[];
  microFeedbackPool: string[];
  cardTheme: { bg: string; accent: string };
};

export type QuestionOption = {
  text: string;
  /** persona id → 加权分 */
  weights: Record<string, number>;
  /** 硬条件标记,如 { shedding: "low" } */
  flags: Record<string, string>;
};

export type Question = {
  id: string;
  text: string;
  options: QuestionOption[];
};

export type HardFlags = Record<string, string>;

export type ScoreResult = {
  personaId: string;
  scores: Record<string, number>;
  hardFlags: HardFlags;
};
