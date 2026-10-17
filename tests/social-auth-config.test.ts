import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEnabledSocialAuthProviderOptions,
  getEnabledSocialAuthProviders,
  getPublicSocialAuthProviderOptions,
  getSocialAuthProviderFlags,
  isSocialAuthProviderEnabled,
} from "../src/lib/social-auth-config";

describe("social auth configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads default public flags through the explicit environment properties", () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_GITHUB_OAUTH_ENABLED", "false");
    expect(getPublicSocialAuthProviderOptions()).toEqual([{ id: "google", label: "Google" }]);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED", "false");
    vi.stubEnv("NEXT_PUBLIC_GITHUB_OAUTH_ENABLED", "true");
    expect(getPublicSocialAuthProviderOptions()).toEqual([{ id: "github", label: "GitHub" }]);
  });

  it("disables every provider when credentials are absent", () => {
    expect(getEnabledSocialAuthProviders({})).toEqual([]);
  });

  it("enables a provider from its complete credential pair", () => {
    expect(
      getEnabledSocialAuthProviders({
        GOOGLE_CLIENT_ID: "google-id",
        GOOGLE_CLIENT_SECRET: "google-secret",
      })
    ).toMatchObject([{ id: "google", label: "Google" }]);
  });

  it("requires a complete credential pair for each provider", () => {
    expect(
      getEnabledSocialAuthProviderOptions({
        GOOGLE_CLIENT_ID: "google-id",
        GITHUB_CLIENT_ID: "github-id",
        GITHUB_CLIENT_SECRET: "github-secret",
      })
    ).toEqual([{ id: "github", label: "GitHub" }]);
  });

  it("exposes only safe provider metadata", () => {
    const environment = {
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      GITHUB_CLIENT_ID: "github-id",
      GITHUB_CLIENT_SECRET: "github-secret",
    };

    expect(getEnabledSocialAuthProviderOptions(environment)).toEqual([
      { id: "google", label: "Google" },
      { id: "github", label: "GitHub" },
    ]);
    expect(isSocialAuthProviderEnabled("google", environment)).toBe(true);
    expect(isSocialAuthProviderEnabled("github", environment)).toBe(true);
    expect(getSocialAuthProviderFlags(environment)).toEqual({
      googleOauthEnabled: true,
      githubOauthEnabled: true,
    });
  });

  it("treats whitespace-only credentials as absent", () => {
    expect(
      getEnabledSocialAuthProviders({
        GOOGLE_CLIENT_ID: "  ",
        GOOGLE_CLIENT_SECRET: "google-secret",
      })
    ).toEqual([]);
  });

  it("public flags helper returns enabled providers when NEXT_PUBLIC flags are true", () => {
    const environment = {
      NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: "true",
      NEXT_PUBLIC_GITHUB_OAUTH_ENABLED: "false",
    };
    expect(getPublicSocialAuthProviderOptions(environment)).toEqual([
      { id: "google", label: "Google" },
    ]);
  });

  it("public flags helper returns empty when flags are false or absent", () => {
    expect(getPublicSocialAuthProviderOptions({})).toEqual([]);
    expect(
      getPublicSocialAuthProviderOptions({ NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: "false" })
    ).toEqual([]);
    expect(getPublicSocialAuthProviderOptions({ NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED: "  " })).toEqual(
      []
    );
  });

  it("public flags helper is case-insensitive for 'true'", () => {
    expect(
      getPublicSocialAuthProviderOptions({ NEXT_PUBLIC_GITHUB_OAUTH_ENABLED: "TRUE" })
    ).toEqual([{ id: "github", label: "GitHub" }]);
    expect(
      getPublicSocialAuthProviderOptions({ NEXT_PUBLIC_GITHUB_OAUTH_ENABLED: "True" })
    ).toEqual([{ id: "github", label: "GitHub" }]);
  });
});
