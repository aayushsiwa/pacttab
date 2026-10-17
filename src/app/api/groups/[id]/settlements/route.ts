import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGroupDetails } from "@/lib/queries";
import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { recordSettlement } from "@/lib/expense-service";

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

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const { id } = await props.params;
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const result = await recordSettlement(auth.user, id, {
    paidByUserId: body.paidByUserId,
    receivedByUserId: body.receivedByUserId,
    amount: body.amount,
  });

  return serviceResponse(result);
}
