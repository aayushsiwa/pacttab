import { NextResponse } from "next/server";
import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { transferAdmin } from "@/lib/group-service";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const { id } = await props.params;
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  if (typeof body.newAdminUserId !== "string" || !body.newAdminUserId) {
    return NextResponse.json({ error: "New admin user is required" }, { status: 400 });
  }

  const result = await transferAdmin(auth.user, id, body.newAdminUserId);

  return serviceResponse(result);
}
