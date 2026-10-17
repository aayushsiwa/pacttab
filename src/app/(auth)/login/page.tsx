import { Suspense } from "react";
import { getEnabledSocialAuthProviderOptions } from "@/lib/social-auth-config";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const providers = getEnabledSocialAuthProviderOptions();

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4">
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading...</div>}>
        <LoginForm providers={providers} />
      </Suspense>
    </div>
  );
}
