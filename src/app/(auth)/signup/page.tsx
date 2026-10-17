import { Suspense } from "react";
import { getEnabledSocialAuthProviderOptions } from "@/lib/social-auth-config";
import { SignUpForm } from "./signup-form";

export default function SignUpPage() {
  const providers = getEnabledSocialAuthProviderOptions();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading...</div>}>
        <SignUpForm providers={providers} />
      </Suspense>
    </div>
  );
}
