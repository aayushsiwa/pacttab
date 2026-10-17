import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserPendingAdminActionsCount } from "@/lib/queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await getUserPendingAdminActionsCount(user.id);
  return NextResponse.json({ count });
}
