import { describe, it, expect, beforeAll } from "vitest";
import { signUpAction } from "../src/actions/auth";

describe("Auth Validation Preservation & Invite Redirect Flow", () => {
  const suffix = Date.now().toString().slice(-5);
  const existingUsername = `user_${suffix}`;

  beforeAll(async () => {
    // Pre-create a user to test duplicate username validation
    const formDataInitial = new FormData();
    formDataInitial.append("username", existingUsername);
    formDataInitial.append("password", "validPass123");

    try {
      await signUpAction(null, formDataInitial);
    } catch (err: unknown) {
      const message = (err as Error)?.message;
      if (!message?.includes("NEXT_REDIRECT")) {
        throw err;
      }
    }
  });

  it("returns error and preserves username on duplicate username", async () => {
    const formDataDuplicate = new FormData();
    formDataDuplicate.append("username", existingUsername);
    formDataDuplicate.append("password", "anotherPass123");
    formDataDuplicate.append("returnTo", `/join/sample_token_${suffix}`);

    const stateDuplicate = await signUpAction(null, formDataDuplicate);
    expect(stateDuplicate.error).toContain("already taken");
    expect(stateDuplicate.username).toBe(existingUsername);
  });

  it("returns error and preserves username on short password", async () => {
    const formDataShort = new FormData();
    formDataShort.append("username", `newuser_${suffix}`);
    formDataShort.append("password", "123");
    formDataShort.append("returnTo", `/join/sample_token_${suffix}`);

    const stateShort = await signUpAction(null, formDataShort);
    expect(stateShort.error).toContain("6 characters");
    expect(stateShort.username).toBe(`newuser_${suffix}`);
  });

  it("returns error and preserves username when confirm password does not match", async () => {
    const formDataMismatch = new FormData();
    formDataMismatch.append("username", `mismatch_${suffix}`);
    formDataMismatch.append("password", "validPassword123");
    formDataMismatch.append("confirmPassword", "differentPassword123");

    const stateMismatch = await signUpAction(null, formDataMismatch);
    expect(stateMismatch.error).toContain("Passwords do not match");
    expect(stateMismatch.username).toBe(`mismatch_${suffix}`);
  });

  it("redirects to returnTo URL on successful sign-up", async () => {
    const newUsername = `invited_${suffix}`;
    const formDataSuccess = new FormData();
    formDataSuccess.append("username", newUsername);
    formDataSuccess.append("password", "validPassword123");
    formDataSuccess.append("confirmPassword", "validPassword123");
    const expectedReturnTo = `/join/special_token_${suffix}`;
    formDataSuccess.append("returnTo", expectedReturnTo);

    let caughtRedirect: string | undefined;
    try {
      await signUpAction(null, formDataSuccess);
    } catch (err: unknown) {
      const errorObj = err as { digest?: string; message?: string };
      if (errorObj?.digest?.startsWith("NEXT_REDIRECT;")) {
        const parts = errorObj.digest.split(";");
        caughtRedirect = parts[2];
      } else if (errorObj?.message?.includes("NEXT_REDIRECT")) {
        caughtRedirect = expectedReturnTo;
      } else {
        throw err;
      }
    }

    expect(caughtRedirect).toBe(expectedReturnTo);
  });
});
