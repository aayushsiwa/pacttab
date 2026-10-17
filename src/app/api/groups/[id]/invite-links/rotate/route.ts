import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { rotateInviteLink } from "@/lib/group-service";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const { id } = await props.params;
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const result = await rotateInviteLink(
    auth.user,
    id,
    typeof body.oldInviteId === "string" ? body.oldInviteId : undefined
  );

  return serviceResponse(result, { token: result.token });
}
