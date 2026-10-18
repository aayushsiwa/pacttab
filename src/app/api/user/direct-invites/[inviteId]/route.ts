import { NextResponse } from "next/server";
import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { respondToDirectInvite } from "@/lib/group-service";

export async function PATCH(request: Request, props: { params: Promise<{ inviteId: string }> }) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const { inviteId } = await props.params;
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const decision = body.decision;
  if (decision !== "accepted" && decision !== "declined") {
    return NextResponse.json({ error: "Decision must be accepted or declined" }, { status: 400 });
  }

  const result = await respondToDirectInvite(auth.user, inviteId, decision);

  return serviceResponse(result);
}
