import { NextRequest, NextResponse } from "next/server";
import { limitedBody } from "@/lib/http-input";
import { webhookValid } from "@/lib/billing-policy";
import { syncSubscription } from "@/lib/razorpay";
import { sqlClient } from "@/lib/db";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  let raw: string;
  try { raw = await limitedBody(req, 100000); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  if (!webhookValid(raw, req.headers.get("x-razorpay-signature"), secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  try {
    const event = JSON.parse(raw);
    const eventId = req.headers.get("x-razorpay-event-id");
    if (!eventId || eventId.length > 200) return NextResponse.json({ error: "Missing event ID" }, { status: 400 });
    const id = event.payload?.subscription?.entity?.id;
    if (typeof id !== "string") return NextResponse.json({ received: true });
    const sql = sqlClient();
    if (!(await sql`select event_id from billing_events where event_id = ${eventId}`).length) await syncSubscription(id, eventId);
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ error: "Retry later" }, { status: 503 }); }
}
