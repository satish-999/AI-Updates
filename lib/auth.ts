/** Customer sessions are opaque random tokens; only their hashes are stored. */
export const COOKIE = "pulse_account_session";
export const SESSION_SECONDS = 30 * 86400;
export function cookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_SECONDS };
}
