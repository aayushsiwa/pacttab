import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { deleteUserAccount } from "@/lib/auth-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const requestHeaders = await headers();
    const result = await deleteUserAccount(body, requestHeaders);
    const status = result.ok ? 200 : result.error.includes("Incorrect") ? 401 : 400;
    return NextResponse.json(result, { status });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
}
