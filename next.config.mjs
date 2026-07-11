import { PHASE_PRODUCTION_BUILD } from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default function config(phase) {
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.NEXT_PUBLIC_PAY_URL) {
    console.warn("\n[V1.4 上线阻塞] 缺少 NEXT_PUBLIC_PAY_URL：付费入口将进入维护兜底，请在生产环境配置后再发布。\n");
  }
  return nextConfig;
}
