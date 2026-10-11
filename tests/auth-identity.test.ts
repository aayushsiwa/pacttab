import { describe, expect, it } from "vitest";
import { localCredentialEmail } from "../src/lib/auth-identity";

describe("localCredentialEmail", () => {
  it("creates a stable, non-deliverable identity from a handle", () => {
    expect(localCredentialEmail("Arjun_99")).toBe("arjun_99@pacttab.local");
  });
});
