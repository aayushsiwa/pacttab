import { authenticateRequest, serviceResponse } from "@/lib/api-auth";
import { revokeInviteLink } from "@/lib/group-service";

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string; inviteId: string }> }
) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const { id, inviteId } = await props.params;
  const result = await revokeInviteLink(auth.user, id, inviteId);

  return serviceResponse(result);
}
