import { createHmac, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
const SUPPORTED_WINDOWS = new Set([60, 1440]);

export type SharedAccessCode = {
  code: string;
  validFrom: Date;
  validUntil: Date;
  windowMinutes: 60 | 1440;
};

function configuredWindowMinutes(): 60 | 1440 {
  const raw = process.env.SHARED_ACCESS_WINDOW_MINUTES;
  if (!raw) return 1440;

  const minutes = Number(raw);
  if (!SUPPORTED_WINDOWS.has(minutes)) {
    throw new Error("SHARED_ACCESS_WINDOW_MINUTES 只能是 60 或 1440");
  }
  return minutes as 60 | 1440;
}

function configuredSecret(): string | null {
  const secret = process.env.SHARED_ACCESS_CODE_SECRET?.trim();
  return secret || null;
}

function codeForWindow(secret: string, windowStartMs: number, windowMinutes: number): string {
  const digest = createHmac("sha256", secret)
    .update(`benmingmao-shared-access:${windowStartMs}:${windowMinutes}`)
    .digest();

  let code = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[digest[index] % ALPHABET.length];
  }
  return code;
}

/**
 * 以北京时间切分时段。日码会在北京时间 00:00 轮换；时码在整点轮换。
 * 没有配置密钥时返回 null，避免意外开启共享兑换。
 */
export function getCurrentSharedAccessCode(now = new Date()): SharedAccessCode | null {
  const secret = configuredSecret();
  if (!secret) return null;

  const windowMinutes = configuredWindowMinutes();
  const windowMs = windowMinutes * 60 * 1000;
  const chinaNowMs = now.getTime() + CHINA_OFFSET_MS;
  const chinaWindowStartMs = Math.floor(chinaNowMs / windowMs) * windowMs;
  const windowStartMs = chinaWindowStartMs - CHINA_OFFSET_MS;
  const validFrom = new Date(windowStartMs);
  const validUntil = new Date(windowStartMs + windowMs);

  return {
    code: codeForWindow(secret, windowStartMs, windowMinutes),
    validFrom,
    validUntil,
    windowMinutes,
  };
}

/** 只接受当前时段的共享码；时段结束后旧码立即失效。 */
export function verifySharedAccessCode(input: string, now = new Date()): SharedAccessCode | null {
  const current = getCurrentSharedAccessCode(now);
  if (!current) return null;

  const normalized = input.trim().toUpperCase();
  const provided = Buffer.from(normalized);
  const expected = Buffer.from(current.code);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  return current;
}
