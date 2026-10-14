import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { signInUser } from "@/lib/auth-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestHeaders = await headers();
    const result = await signInUser(body, requestHeaders);
    const status = result.ok ? 200 : result.error.includes("Invalid") ? 401 : 400;
    return NextResponse.json(result, { status });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
