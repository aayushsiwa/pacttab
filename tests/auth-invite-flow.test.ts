import { signUpAction } from "../src/actions/auth";

async function testAuthInviteFlow() {
  console.log("🚀 Testing Auth validation preservation and invite returnTo redirect...\n");

  const suffix = Date.now().toString().slice(-5);
  const existingUsername = `user_${suffix}`;

  // 1. Pre-create a user
  const formDataInitial = new FormData();
  formDataInitial.append("username", existingUsername);
  formDataInitial.append("password", "validPass123");

  try {
    await signUpAction(null, formDataInitial);
  } catch (err: unknown) {
    // redirect error is expected
    const message = (err as Error)?.message;
    if (!message?.includes("NEXT_REDIRECT")) {
      throw err;
    }
  }

  // 2. Test duplicate username validation preservation
  console.log("1. Testing duplicate username returns error and preserves username...");
  const formDataDuplicate = new FormData();
  formDataDuplicate.append("username", existingUsername);
  formDataDuplicate.append("password", "anotherPass123");
  formDataDuplicate.append("returnTo", `/join/sample_token_${suffix}`);

  const stateDuplicate = await signUpAction(null, formDataDuplicate);
  if (!stateDuplicate.error || !stateDuplicate.error.includes("already taken")) {
    throw new Error(`Expected 'already taken' error, got: ${JSON.stringify(stateDuplicate)}`);
  }
  if (stateDuplicate.username !== existingUsername) {
    throw new Error(`Expected preserved username '${existingUsername}', got '${stateDuplicate.username}'`);
  }
  console.log(`   ✓ Correctly returned error: "${stateDuplicate.error}" and preserved username: "${stateDuplicate.username}"`);

  // 3. Test short password validation preservation
  console.log("2. Testing validation error for short password...");
  const formDataShort = new FormData();
  formDataShort.append("username", `newuser_${suffix}`);
  formDataShort.append("password", "123");
  formDataShort.append("returnTo", `/join/sample_token_${suffix}`);

  const stateShort = await signUpAction(null, formDataShort);
  if (!stateShort.error || !stateShort.error.includes("6 characters")) {
    throw new Error(`Expected password length error, got: ${JSON.stringify(stateShort)}`);
  }
  if (stateShort.username !== `newuser_${suffix}`) {
    throw new Error(`Expected preserved username 'newuser_${suffix}', got '${stateShort.username}'`);
  }
  console.log(`   ✓ Correctly returned error: "${stateShort.error}" and preserved username: "${stateShort.username}"`);

  // 4. Test success redirect to returnTo
  console.log("3. Testing successful sign-up redirects to returnTo URL...");
  const newUsername = `invited_${suffix}`;
  const formDataSuccess = new FormData();
  formDataSuccess.append("username", newUsername);
  formDataSuccess.append("password", "validPassword123");
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

  if (caughtRedirect !== expectedReturnTo) {
    throw new Error(`Expected redirect to '${expectedReturnTo}', got '${caughtRedirect}'`);
  }
  console.log(`   ✓ Correctly redirected to returnTo URL: "${caughtRedirect}"`);

  console.log("\n🎉 ALL AUTH VALIDATION & INVITE RETURNTO TESTS PASSED!\n");
  process.exit(0);
}

testAuthInviteFlow().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
