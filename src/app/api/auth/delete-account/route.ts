import { authenticateRequest, parseJsonBody, serviceResponse } from "@/lib/api-auth";
import { deleteUserAccount } from "@/lib/auth-service";

export async function POST(request: Request) {
  const auth = await authenticateRequest();
  if (auth.response) return auth.response;

  const parsed = await parseJsonBody(request);
  if (parsed.response) return parsed.response;

  const body = (parsed.data ?? {}) as { password?: string };
  const result = await deleteUserAccount(auth.user, { password: body.password ?? "" });

  return serviceResponse(result);
}
