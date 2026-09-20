"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { SocialAuthProvider } from "@/lib/social-auth-config";

interface SocialSignInOptionsProps {
  providers: { id: SocialAuthProvider; label: string }[];
  returnTo?: string;
}

export function SocialSignInOptions({ providers, returnTo }: SocialSignInOptionsProps) {
  if (providers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          or continue with
        </span>
        <div className="bg-border h-px flex-1" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            className="h-10 rounded-xl text-xs font-semibold"
            onClick={() =>
              authClient.signIn.social({
                provider: provider.id,
                callbackURL: returnTo || "/groups",
              })
            }
          >
            Continue with {provider.label}
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
        Optional. Connecting a provider may share your email and basic profile with PactTab.
      </p>
    </div>
  );
}
