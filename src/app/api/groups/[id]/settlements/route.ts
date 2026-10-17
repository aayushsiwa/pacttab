import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGroupDetails } from "@/lib/queries";

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

  return NextResponse.json(details.settlements);
}
