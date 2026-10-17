import { describe, it, expect, beforeAll } from "vitest";
import { signUpUser, type AuthActionResult } from "../src/lib/auth-service";

function assertError(
  result: AuthActionResult
): asserts result is AuthActionResult & { ok: false; error: string } {
  if (result.ok) throw new Error("Expected error result");
}

describe("Auth Validation Preservation & Invite Redirect Flow", () => {
  const suffix = Date.now().toString().slice(-5);
  const existingUsername = `user_${suffix}`;

  beforeAll(async () => {
    // Pre-create a user to test duplicate username validation
    await signUpUser({
      username: existingUsername,
      password: "validPass123",
      confirmPassword: "validPass123",
    });
  });

  it("returns error and preserves username on duplicate username", async () => {
    const result = await signUpUser({
      username: existingUsername,
      password: "anotherPass123",
      confirmPassword: "anotherPass123",
    });
    assertError(result);
    expect(result.error).toContain("already taken");
    expect(result.username).toBe(existingUsername);
  });

  it("returns error and preserves username on short password", async () => {
    const result = await signUpUser({
      username: `newuser_${suffix}`,
      password: "123",
      confirmPassword: "123",
    });
    assertError(result);
    expect(result.error).toContain("6 characters");
    expect(result.username).toBe(`newuser_${suffix}`);
  });

  it("returns error and preserves username when confirm password does not match", async () => {
    const result = await signUpUser({
      username: `mismatch_${suffix}`,
      password: "validPassword123",
      confirmPassword: "differentPassword123",
    });
    assertError(result);
    expect(result.error).toContain("Passwords do not match");
    expect(result.username).toBe(`mismatch_${suffix}`);
  });

  it("returns ok on successful sign-up", async () => {
    const newUsername = `invited_${suffix}`;
    const result = await signUpUser({
      username: newUsername,
      password: "validPassword123",
      confirmPassword: "validPassword123",
    });
    expect(result.ok).toBe(true);
    expect(result.username).toBe(newUsername);
  });
});
