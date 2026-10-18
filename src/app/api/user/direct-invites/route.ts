import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserPendingDirectInvites } from "@/lib/queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.needsUsername) {
    return NextResponse.json({ error: "Onboarding required" }, { status: 403 });
  }

  const invites = await getUserPendingDirectInvites(user.id);
  return NextResponse.json(invites);
}
