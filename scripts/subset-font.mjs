// 分享卡中文字体子集化脚本。
// 原理:@vercel/og(satori)渲染文字必须内嵌字体;完整中文字体约20MB,
// 而卡片上出现的字只来自 personas.json + 固定文案,把字体裁剪到这些字符即可(约几十KB)。
// 运营者改动 personas.json 后必须重新运行:npm run font:subset
import fs from "node:fs";
import path from "node:path";
import subsetFont from "subset-font";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "assets", "fonts-src", "LXGWWenKai-Regular.ttf");
const OUT_DIR = path.join(ROOT, "assets", "fonts");
const OUT = path.join(OUT_DIR, "card-font.ttf");

// 与 app/api/card/ 和 app/api/premium-card/ 两个路由中的固定文案保持一致。
// 卡面新增任何中文文案,必须同步加进这里并重跑 npm run font:subset。
const FIXED_TEXT = [
  // 免费卡
  "本命猫鉴定所",
  "你的本命猫",
  "测测你内心住着哪只猫",
  "扫码直达",
  "卡片不存在",
  "人格数据缺失",
  // 付费卡
  "本命猫深度报告",
  "付费定制版",
  "我的猫系人格",
  "专属猫名",
  "仅此一份",
  "扫码测测你的本命猫",
  "请先解锁并完成定制问题",
  // 付费卡亮点标签
  "预算安全度",
  "情绪陪伴关键词",
  "养猫节奏建议",
  "主要风险提醒",
  "待补充",
  // 付费卡亮点取值(lib/premium.ts PREMIUM_FLAG_LABELS 中卡面会用到的三组 + 节奏文案)
  "预算安全垫偏低,需要控制品种和用品选择",
  "预算安全垫中等,适合基础稳定配置",
  "预算安全垫较好,能覆盖更稳的日常配置",
  "预算安全垫较高,更在意省心和品质",
  "核心情绪需求是稳定陪伴",
  "核心情绪需求是被安慰和被接住",
  "核心情绪需求是建立生活秩序",
  "核心情绪需求是互动和快乐",
  "还在探索自己为什么想靠近猫",
  "最担心长期花费",
  "最担心清洁压力",
  "最担心生病和医疗",
  "最担心时间精力不够",
  "最担心家人、室友或房东许可",
  "最担心和猫性格不合",
  "先列清单,再确定接猫时间",
  "先确认居住许可,再安排接猫",
  "先准备医疗备用金,再进入养猫",
  "选择互动强但可训练的节奏",
  "稳定推进,把长期照顾排进生活",
  // 付费卡专属猫名
  "小棉小钟跳跳灯灯小满",
];

// 常用中文标点 + 全角字符
const PUNCTUATION = "「」『』。，、；：？！…—·（）《》〈〉“”‘’～ ¥";

// ASCII 可见字符(短链/数字用)
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");

function collectStrings(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(collectStrings).join("");
  if (value && typeof value === "object") return Object.values(value).map(collectStrings).join("");
  return "";
}

const personas = JSON.parse(fs.readFileSync(path.join(ROOT, "content", "personas.json"), "utf8"));
const corpus = collectStrings(personas) + FIXED_TEXT.join("") + PUNCTUATION + ASCII;
const uniqueChars = [...new Set([...corpus])].join("");

if (!fs.existsSync(SRC)) {
  console.error(`[font] 缺少字体源文件: ${SRC}`);
  console.error("[font] 请下载霞鹜文楷(可商用开源, SIL OFL 1.1):");
  console.error("[font]   https://github.com/lxgw/LxgwWenKai/releases 下载 LXGWWenKai-Regular.ttf");
  console.error(`[font] 放到 assets/fonts-src/ 后重新运行 npm run font:subset`);
  process.exit(1);
}

const source = fs.readFileSync(SRC);
const subset = await subsetFont(source, uniqueChars, { targetFormat: "sfnt" });
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, subset);

console.log(`[font] 覆盖字符数: ${uniqueChars.length}`);
console.log(`[font] 源文件: ${(source.length / 1024 / 1024).toFixed(1)} MB → 子集: ${(subset.length / 1024).toFixed(1)} KB`);
console.log(`[font] 已写入 ${OUT}`);
