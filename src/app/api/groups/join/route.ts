import { NextResponse } from "next/server";
import { authenticateRequest, parseJsonBody } from "@/lib/api-auth";
import { joinGroup } from "@/lib/group-service";

export async function POST(request: Request) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
  }

  const result = await joinGroup(token, auth.user);

  if (result.success || result.pendingApproval || result.canRequestJoin) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
}
