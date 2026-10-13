import type { NextRequest } from "next/server";
import { authEndpoint } from "@/lib/auth-endpoint";
export const runtime = "nodejs";
export async function POST(request: NextRequest) { return authEndpoint(request, "login"); }
