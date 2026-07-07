// 全局领域类型:内容数据(/content)与计分引擎共用
export type Breed = { name: string; reason: string };

export type BreedLevel = "low" | "mid" | "mid_high" | "high";
export type BreedSimpleLevel = "low" | "mid" | "high";

export type BreedProfile = {
  name: string;
  shedding: BreedSimpleLevel;
  activity: BreedSimpleLevel;
  clinginess: BreedSimpleLevel;
  grooming: BreedLevel;
  monthlyCost: BreedLevel;
  vetRisk: BreedSimpleLevel;
  healthRisks: string[];
  beginnerFit: BreedSimpleLevel;
  smallSpaceFit: BreedSimpleLevel;
  availability: BreedSimpleLevel;
  costDetail: {
    food: [number, number];
    litter: [number, number];
    other: [number, number];
  };
};

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

export type PremiumQuestionCategory =
  | "income"
  | "budget"
  | "housing"
  | "emotion"
  | "lifestyle"
  | "risk"
  | "preference";

export type PremiumQuestionOption = {
  text: string;
  value: string;
  flags: Record<string, string>;
};

export type PremiumQuestion = {
  id: string;
  text: string;
  helper?: string;
  category: PremiumQuestionCategory;
  options: PremiumQuestionOption[];
};

export type PremiumFlags = Record<string, string>;

export type BreedConflictType =
  | "shedding"
  | "budget"
  | "space"
  | "beginner"
  | "availability"
  | "time"
  | "medical"
  | "allergy"
  | "consent"
  | "noise";

export type BreedConflict = {
  hasConflict: boolean;
  types: BreedConflictType[];
  typeLabels: string[];
  primaryBreed: string;
  softAlternative?: string;
  softAlternativeReason?: string;
  message?: string;
};

export type ScoreResult = {
  personaId: string;
  scores: Record<string, number>;
  hardFlags: HardFlags;
};
