import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { createInviteLink } from "@/lib/group-service";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const { id } = await props.params;
  const body = (parsed.data ?? {}) as Record<string, unknown>;
  const result = await createInviteLink(auth.user, id, {
    expiresInHours: typeof body.expiresInHours === "number" ? body.expiresInHours : null,
    maxUses: typeof body.maxUses === "number" ? body.maxUses : null,
    requiresApproval: typeof body.requiresApproval === "boolean" ? body.requiresApproval : false,
    customSlug: typeof body.customSlug === "string" ? body.customSlug : null,
  });

  return serviceResponse(result, { token: result.token });
}
