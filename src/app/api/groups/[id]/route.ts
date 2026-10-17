import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGroupDetails } from "@/lib/queries";
import { deleteGroupAction, updateGroupAction } from "@/actions/groups";
import { groupDetailsSchema } from "@/lib/group-validation";

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;
  const details = await getGroupDetails(id, user.id);
  if (!details) {
    return NextResponse.json({ error: "Group not found or unauthorized" }, { status: 404 });
  }

  return NextResponse.json(details);
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
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

  const { id } = await props.params;
  const result = await updateGroupAction(id, parsed.data.name, parsed.data.description);
  const status = result.success
    ? 200
    : result.error === "Only admins can update group settings"
      ? 403
      : 500;
  return NextResponse.json(result, { status });
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.needsUsername) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 403 });
  }

  const { id } = await props.params;
  const result = await deleteGroupAction(id);
  const status = result.success
    ? 200
    : result.error === "Only admins can delete a group"
      ? 403
      : 500;
  return NextResponse.json(result, { status });
}
