import { timingSafeEqual } from "node:crypto";

export function hasAdminSecret(): boolean {
  return Boolean(process.env.ADMIN_SECRET);
}

export function adminSecretMatches(provided: string): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return false;

  const actualBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(actualBytes, expectedBytes);
}
