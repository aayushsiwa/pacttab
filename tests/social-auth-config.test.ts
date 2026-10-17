import { describe, expect, it } from "vitest";
import {
  getEnabledSocialAuthProviderOptions,
  getEnabledSocialAuthProviders,
} from "../src/lib/social-auth-config";

describe("social auth configuration", () => {
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
    expect(
      getEnabledSocialAuthProviderOptions({
        GOOGLE_CLIENT_ID: "google-id",
        GOOGLE_CLIENT_SECRET: "google-secret",
        GITHUB_CLIENT_ID: "github-id",
        GITHUB_CLIENT_SECRET: "github-secret",
      })
    ).toEqual([
      { id: "google", label: "Google" },
      { id: "github", label: "GitHub" },
    ]);
  });

  it("treats whitespace-only credentials as absent", () => {
    expect(
      getEnabledSocialAuthProviders({
        GOOGLE_CLIENT_ID: "  ",
        GOOGLE_CLIENT_SECRET: "google-secret",
      })
    ).toEqual([]);
  });
});
