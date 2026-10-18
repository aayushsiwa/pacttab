import { authenticateRequest, serviceResponse } from "@/lib/api-auth";
import { rejectSettlement } from "@/lib/expense-service";

export async function POST(
  _request: Request,
  props: { params: Promise<{ id: string; settlementId: string }> }
) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const { id, settlementId } = await props.params;
  const result = await rejectSettlement(auth.user, id, settlementId);

  return serviceResponse(result);
}
