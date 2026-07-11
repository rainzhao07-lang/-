export type ReportSimilarityOptions = {
  reasonableRepeatLines?: string[];
  reasonableRepeatPrefixes?: string[];
};

export type ReportSimilarityResult = {
  totalSentenceCount: number;
  rawDuplicateCount: number;
  rawRatio: number;
  variableSentenceCount: number;
  variableDuplicateCount: number;
  variableRatio: number;
  variableDuplicates: string[];
};

const FACT_LINE_PREFIXES = [
  "## ",
  "你的测试结果是",
  "参考月花费：",
  "预算：",
  "空间：",
  "居住许可：",
  "作息：",
  "医疗承受力：",
  "综合判断：",
  "在你最在意的几个维度上",
  "掉毛压力：",
  "月花费(主粮+猫砂+护理合计)：",
  "小空间适配：",
  "粘人程度：",
  "第一个月准备清单：",
  "倡导领养代替购买",
];

export function reportSentenceSimilarity(
  leftReport: string,
  rightReport: string,
  options: ReportSimilarityOptions = {},
): ReportSimilarityResult {
  const reasonableLines = new Set(
    (options.reasonableRepeatLines ?? []).flatMap((line) => [line, normalizeChinesePunctuation(line)]),
  );
  const reasonablePrefixes = [
    ...FACT_LINE_PREFIXES,
    ...(options.reasonableRepeatPrefixes ?? []),
  ];
  const left = splitReport(leftReport, reasonableLines, reasonablePrefixes);
  const right = splitReport(rightReport, reasonableLines, reasonablePrefixes);
  const rightAll = new Set(right.map((item) => item.sentence));
  const rawDuplicates = left.filter((item) => rightAll.has(item.sentence));
  const leftVariable = left.filter((item) => !item.reasonableRepeat);
  const rightVariable = new Set(
    right.filter((item) => !item.reasonableRepeat).map((item) => item.sentence),
  );
  const variableDuplicates = leftVariable
    .filter((item) => rightVariable.has(item.sentence))
    .map((item) => item.sentence);

  return {
    totalSentenceCount: left.length,
    rawDuplicateCount: rawDuplicates.length,
    rawRatio: ratio(rawDuplicates.length, left.length),
    variableSentenceCount: leftVariable.length,
    variableDuplicateCount: variableDuplicates.length,
    variableRatio: ratio(variableDuplicates.length, leftVariable.length),
    variableDuplicates,
  };
}

function splitReport(
  report: string,
  reasonableLines: Set<string>,
  reasonablePrefixes: string[],
): Array<{ sentence: string; reasonableRepeat: boolean }> {
  return report.split("\n").flatMap((rawLine) => {
    const line = rawLine.trim();
    if (!line) return [];
    const reasonableRepeat = reasonableLines.has(line)
      || reasonablePrefixes.some((prefix) => line.startsWith(prefix))
      || /^为.{1,16}多准备：/.test(line);
    return line
      .split(/[。！？!?；;]/)
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((sentence) => ({ sentence, reasonableRepeat }));
  });
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function normalizeChinesePunctuation(value: string): string {
  return value
    .replace(/([\u3400-\u9fff）】》」』”’]),/g, "$1，")
    .replace(/([\u3400-\u9fff）】》」』”’]):/g, "$1：")
    .replace(/([\u3400-\u9fff）】》」』”’]);/g, "$1；")
    .replace(/([\u3400-\u9fff）】》」』”’])\?/g, "$1？")
    .replace(/([\u3400-\u9fff）】》」』”’])!/g, "$1！");
}
