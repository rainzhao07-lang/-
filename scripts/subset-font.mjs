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

// 与 app/api/card/[sessionId]/route.tsx 中的固定文案保持一致
const FIXED_TEXT = [
  "本命猫鉴定所",
  "你的本命猫",
  "测测你内心住着哪只猫",
  "卡片不存在",
  "人格数据缺失",
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
