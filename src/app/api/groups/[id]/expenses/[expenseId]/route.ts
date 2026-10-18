import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { deleteExpense, updateExpense } from "@/lib/expense-service";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; expenseId: string }> }
) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const { id, expenseId } = await props.params;
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const result = await updateExpense(auth.user, id, expenseId, {
    description: body.description,
    amount: body.amount,
    paidByUserId: body.paidByUserId,
    participantUserIds: body.participantUserIds,
    splitType: body.splitType,
    customSplits: body.customSplits,
    expenseDate: body.expenseDate,
  });

  return serviceResponse(result);
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string; expenseId: string }> }
) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const { id, expenseId } = await props.params;
  const result = await deleteExpense(auth.user, id, expenseId);

  return serviceResponse(result);
}
