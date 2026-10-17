import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserGroups } from "@/lib/queries";
import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { createGroup } from "@/lib/group-service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await getUserGroups(user.id);
  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const result = await createGroup(auth.user, {
    name: body.name,
    description: body.description,
  });

  return serviceResponse(result, { groupId: result.groupId }, 201);
}
