export const SOCIAL_AUTH_PROVIDERS = ["google", "github"] as const;

export type SocialAuthProvider = (typeof SOCIAL_AUTH_PROVIDERS)[number];

export interface SocialAuthProviderConfig {
  id: SocialAuthProvider;
  label: string;
  clientId: string;
  clientSecret: string;
}

export interface SocialAuthProviderFlags {
  googleOauthEnabled: boolean;
  githubOauthEnabled: boolean;
}

type Environment = Readonly<Record<string, string | undefined>>;

const providerMetadata: Record<
  SocialAuthProvider,
  Omit<SocialAuthProviderConfig, "clientId" | "clientSecret">
> = {
  google: { id: "google", label: "Google" },
  github: { id: "github", label: "GitHub" },
};

function configuredValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Returns only providers with a complete credential pair. Credentials never leave
 * the server through this API.
 */
export function getEnabledSocialAuthProviders(
  environment: Environment = process.env
): SocialAuthProviderConfig[] {
  return SOCIAL_AUTH_PROVIDERS.flatMap((provider) => {
    const prefix = provider.toUpperCase();
    const clientId = configuredValue(environment[`${prefix}_CLIENT_ID`]);
    const clientSecret = configuredValue(environment[`${prefix}_CLIENT_SECRET`]);

    if (!clientId || !clientSecret) {
      return [];
    }

    return [{ ...providerMetadata[provider], clientId, clientSecret }];
  });
}

/** Provider-specific flags intended for server-side conditional rendering. */
export function getSocialAuthProviderFlags(
  environment: Environment = process.env
): SocialAuthProviderFlags {
  return {
    googleOauthEnabled: isSocialAuthProviderEnabled("google", environment),
    githubOauthEnabled: isSocialAuthProviderEnabled("github", environment),
  };
}

/** Public metadata safe to pass from a Server Component to a Client Component. */
export function getEnabledSocialAuthProviderOptions(environment: Environment = process.env) {
  return getEnabledSocialAuthProviders(environment).map(({ id, label }) => ({ id, label }));
}

export function isSocialAuthProviderEnabled(
  provider: SocialAuthProvider,
  environment: Environment = process.env
): boolean {
  return getEnabledSocialAuthProviders(environment).some(({ id }) => id === provider);
}
