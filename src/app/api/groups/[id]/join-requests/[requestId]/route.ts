import { NextResponse } from "next/server";
import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { reviewJoinRequest } from "@/lib/group-service";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; requestId: string }> }
) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const { id, requestId } = await props.params;
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const decision = body.decision;
  if (decision !== "approved" && decision !== "declined") {
    return NextResponse.json({ error: "Decision must be approved or declined" }, { status: 400 });
  }

  const result = await reviewJoinRequest(auth.user, id, requestId, decision);

  return serviceResponse(result);
}
