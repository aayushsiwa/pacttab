import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { signOutUser } from "@/lib/auth-service";

export async function POST() {
  const requestHeaders = await headers();
  const result = await signOutUser(requestHeaders);
  const status = result.ok ? 200 : 400;
  return NextResponse.json(result, { status });
}
