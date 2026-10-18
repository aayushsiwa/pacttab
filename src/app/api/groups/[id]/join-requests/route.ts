import { authenticateRequest, serviceResponse } from "@/lib/api-auth";
import { createJoinRequest } from "@/lib/group-service";

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const { id } = await props.params;
  const result = await createJoinRequest(auth.user, id);

  return serviceResponse(result);
}
