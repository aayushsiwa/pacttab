import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export interface ApiUser {
  id: string;
  username: string;
}

export type ApiAuthResult =
  | { user: ApiUser; response?: undefined }
  | { user?: undefined; response: NextResponse };

/** Resolves the authenticated user for a route handler, or a JSON error response. */
export async function authenticateRequest(): Promise<ApiAuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.needsUsername) {
    return { response: NextResponse.json({ error: "Onboarding required" }, { status: 403 }) };
  }
  return { user: { id: user.id, username: user.username } };
}

/** Parses a JSON request body, returning a 400 response when the payload is malformed. */
export async function parseJsonBody(
  request: Request
): Promise<{ data: unknown; response?: undefined } | { data?: undefined; response: NextResponse }> {
  try {
    return { data: await request.json() };
  } catch {
    return { response: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }
}

export interface ServiceResult {
  success: boolean;
  error?: string;
  status?: number;
}

/** Maps a service-layer result to a JSON response (defaults: 400 on failure, 200 on success). */
export function serviceResponse(
  result: ServiceResult,
  extra: Record<string, unknown> = {},
  successStatus = 200
): NextResponse {
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  }
  return NextResponse.json({ success: true, ...extra }, { status: successStatus });
}
