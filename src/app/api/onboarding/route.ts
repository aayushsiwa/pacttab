import { NextResponse } from "next/server";
import { completeOnboardingAction } from "@/actions/onboarding";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const formData = new FormData();
    formData.append("username", body.username);

    const result = await completeOnboardingAction(formData);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
}
