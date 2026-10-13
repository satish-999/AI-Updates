import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";

const COST = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_]{2,29}$/.test(username) ? username : null;
}
export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128
    && Buffer.byteLength(value, "utf8") <= 512;
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, COST, (error, key) => error ? reject(error) : resolve(key)));
}
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error("Invalid password length");
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: unknown, encoded: string): Promise<boolean> {
  if (!validPassword(password)) return false;
  const parts = encoded.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt-v1" || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const actual = await derive(password, parts[1]);
  return timingSafeEqual(actual, Buffer.from(parts[2], "hex"));
}
export function randomToken(): string { return randomBytes(32).toString("hex"); }
export function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function validToken(token: unknown): token is string { return typeof token === "string" && /^[a-f0-9]{64}$/.test(token); }
// Valid-cost dummy verification prevents fast username-existence timing differences.
export const DUMMY_PASSWORD_HASH = `scrypt-v1$${"0".repeat(32)}$${"0".repeat(128)}`;
