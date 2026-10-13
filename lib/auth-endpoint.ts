import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, cookieOptions } from "./auth";
import { authenticate, createAccount, createSession, recoverAccount, reserveLimit } from "./accounts";
import { normalizeUsername, validPassword } from "./passwords";
import { sameOrigin, jsonBody, clientBucket } from "./request-security";

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export async function authEndpoint(request: NextRequest, mode: "login" | "signup" | "recover") {
  if (!sameOrigin(request)) return reply({ error: "Please submit from this application." }, 403);
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return reply({ error: "Invalid request." }, 400); }
  const username = normalizeUsername(body.username);
  if (!username || !validPassword(body.password)) return reply({ error: "Use a valid username and a password of 12–128 characters." }, 400);
  let stage = "configuration";
  try {
    if (!process.env.AUTH_SECRET) throw new Error("AUTH_CONFIG");
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_CONFIG");
    stage = "rate-limit";
    const ip = clientBucket(request);
    const limit = mode === "signup" ? 5 : 15;
    const seconds = mode === "signup" ? 3600 : 900;
    if (!await reserveLimit(`auth:${mode}:ip:${ip}`, limit, seconds)
      || !await reserveLimit(`auth:${mode}:name:${username}`, 15, 900)) {
      return reply({ error: "Too many attempts. Please try again later." }, 429);
    }
    stage = "credentials";
    if (mode === "recover") {
      const code = typeof body.recoveryCode === "string" ? body.recoveryCode.trim().toLowerCase() : "";
      const recoveryCode = await recoverAccount(username, code, body.password);
      return recoveryCode ? reply({ recoveryCode }) : reply({ error: "The username or recovery code is incorrect." }, 400);
    }
    const created = mode === "signup" ? await createAccount(username, body.password) : null;
    const user = mode === "signup" ? created?.user : await authenticate(username, body.password);
    if (!user) return reply({ error: mode === "signup" ? "That username is unavailable." : "The username or password is incorrect." }, 400);
    stage = "session";
    const token = await createSession(user.id, user.auth_version);
    const response = reply({ ok: true, recoveryCode: created?.recoveryCode });
    response.cookies.set(COOKIE, token, cookieOptions());
    return response;
  } catch (error) {
    const reference = stage === "configuration"
      ? (error instanceof Error && error.message === "AUTH_CONFIG" ? "ACCOUNT_CONFIG_AUTH" : "ACCOUNT_CONFIG_DATABASE")
      : stage === "rate-limit" ? "ACCOUNT_DATABASE" : stage === "session" ? "ACCOUNT_SESSION" : "ACCOUNT_CREDENTIALS";
    console.error("Account service failure", { reference });
    // Never echo connection strings, SQL, password hashes or recovery material.
    return reply({ error: "Account services are temporarily unavailable. Please try again shortly.", reference }, 503);
  }
}
