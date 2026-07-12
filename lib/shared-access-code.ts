import { createHmac, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAILY_ROLLOVER_OFFSET_MS = 18 * 60 * 60 * 1000;
const PREVIOUS_WINDOW_GRACE_MS = 15 * 60 * 1000;
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

function accessCodeForWindow(
  secret: string,
  windowStartMs: number,
  windowMinutes: 60 | 1440,
): SharedAccessCode {
  return {
    code: codeForWindow(secret, windowStartMs, windowMinutes),
    validFrom: new Date(windowStartMs),
    validUntil: new Date(windowStartMs + windowMinutes * 60 * 1000),
    windowMinutes,
  };
}

function previousAccessCode(current: SharedAccessCode): SharedAccessCode | null {
  const secret = configuredSecret();
  if (!secret) return null;
  const windowMs = current.windowMinutes * 60 * 1000;
  return accessCodeForWindow(secret, current.validFrom.getTime() - windowMs, current.windowMinutes);
}

function matchesCode(input: string, expectedCode: string): boolean {
  const normalized = input.trim().toUpperCase();
  const provided = Buffer.from(normalized);
  const expected = Buffer.from(expectedCode);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

/**
 * 以北京时间切分时段。日码会在北京时间 18:00 轮换；时码在整点轮换。
 * 没有配置密钥时返回 null，避免意外开启共享兑换。
 */
export function getCurrentSharedAccessCode(now = new Date()): SharedAccessCode | null {
  const secret = configuredSecret();
  if (!secret) return null;

  const windowMinutes = configuredWindowMinutes();
  const windowMs = windowMinutes * 60 * 1000;
  const chinaNowMs = now.getTime() + CHINA_OFFSET_MS;
  const rolloverOffsetMs = windowMinutes === 1440 ? DAILY_ROLLOVER_OFFSET_MS : 0;
  const shiftedChinaNowMs = chinaNowMs - rolloverOffsetMs;
  const chinaWindowStartMs = Math.floor(shiftedChinaNowMs / windowMs) * windowMs + rolloverOffsetMs;
  const windowStartMs = chinaWindowStartMs - CHINA_OFFSET_MS;
  return accessCodeForWindow(secret, windowStartMs, windowMinutes);
}

/** 当前窗口码始终有效；上一窗口码在轮换后的15分钟内继续有效。 */
export function verifySharedAccessCode(input: string, now = new Date()): SharedAccessCode | null {
  const current = getCurrentSharedAccessCode(now);
  if (!current) return null;
  if (matchesCode(input, current.code)) return current;

  const previous = previousAccessCode(current);
  if (!previous) return null;
  const elapsedSinceRollover = now.getTime() - previous.validUntil.getTime();
  if (elapsedSinceRollover < 0 || elapsedSinceRollover > PREVIOUS_WINDOW_GRACE_MS) return null;
  return matchesCode(input, previous.code) ? previous : null;
}

/** 仅识别当前时段的上一窗口码，供接口返回明确的“已换码”提示。 */
export function isExpiredPreviousSharedAccessCode(input: string, now = new Date()): boolean {
  const current = getCurrentSharedAccessCode(now);
  if (!current || matchesCode(input, current.code)) return false;

  const previous = previousAccessCode(current);
  if (!previous) return false;
  const elapsedSinceRollover = now.getTime() - previous.validUntil.getTime();
  return elapsedSinceRollover > PREVIOUS_WINDOW_GRACE_MS && matchesCode(input, previous.code);
}
