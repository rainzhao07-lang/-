import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // 与 tsconfig paths 保持一致:@/* → 项目根
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
  },
});
