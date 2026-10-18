import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { createDirectInvite } from "@/lib/group-service";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const { id } = await props.params;
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const result = await createDirectInvite(auth.user, id, { username: body.username });

  return serviceResponse(
    result,
    { inviteId: result.inviteId, token: result.token, inviteeUsername: result.inviteeUsername },
    201
  );
}
