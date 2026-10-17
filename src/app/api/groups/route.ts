import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserGroups } from "@/lib/queries";
import { createGroupAction } from "@/actions/groups";
import { groupDetailsSchema } from "@/lib/group-validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groups = await getUserGroups(user.id);
  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.needsUsername) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = groupDetailsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const formData = new FormData();
  formData.set("name", parsed.data.name);
  if (parsed.data.description !== undefined) {
    formData.set("description", parsed.data.description);
  }
  const result = await createGroupAction(null, formData);
  return NextResponse.json(result, { status: result.success ? 201 : 500 });
}
