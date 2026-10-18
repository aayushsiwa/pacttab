import { authenticateRequest, serviceResponse } from "@/lib/api-auth";
import { leaveGroup } from "@/lib/group-service";

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const { id } = await props.params;
  const result = await leaveGroup(auth.user, id);

  return serviceResponse(result);
}
