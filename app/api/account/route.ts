import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, cookieOptions } from "@/lib/auth";
import { sessionAccount, reserveLimit } from "@/lib/accounts";
import { changePassword, deleteAccount } from "@/lib/account-settings";
import { sameOrigin, jsonBody } from "@/lib/request-security";
import { validPassword } from "@/lib/passwords";
export async function POST(request: NextRequest) {
  const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!sameOrigin(request)) return reply({ error: "Please submit from this application." }, 403);
  let body;
  try { body = await jsonBody(request); } catch { return reply({ error: "Invalid request." }, 400); }
  if (!validPassword(body.password) || !["password", "delete"].includes(String(body.action))) return reply({ error: "Invalid request." }, 400);
  if (body.action === "password" && !validPassword(body.newPassword)) return reply({ error: "Use a new password of 12–128 characters." }, 400);
  try {
    const user = await sessionAccount(request.cookies.get(COOKIE)?.value);
    if (!user) return reply({ error: "Please sign in." }, 401);
    if (!await reserveLimit(`settings:${user.id}`, 5, 900)) return reply({ error: "Too many attempts. Try again later." }, 429);
    if (body.action === "delete" && body.confirmation !== user.username) return reply({ error: "Enter your username to confirm deletion." }, 400);
    const code = body.action === "password" ? await changePassword(user, body.password, body.newPassword as string) : null;
    const deleted = body.action === "delete" ? await deleteAccount(user, body.password) : false;
    if (!code && !deleted) return reply({ error: "Password incorrect or account changed. Sign in and try again." }, 400);
    const response = reply({ ok: true, recoveryCode: code });
    response.cookies.set(COOKIE, "", { ...cookieOptions(), maxAge: 0 });
    return response;
  } catch { return reply({ error: "Account services are temporarily unavailable." }, 503); }
}
