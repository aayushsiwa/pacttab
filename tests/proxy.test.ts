import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

describe("authentication proxy", () => {
  it.each(["/login", "/signup"])("allows %s with a stale session cookie", async (path) => {
    const response = await proxy(
      new NextRequest(`http://localhost:3000${path}`, {
        headers: { cookie: "better-auth.session_token=expired-session" },
      })
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("preserves the login redirect for protected paths without a cookie", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/group/example"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?returnTo=%2Fgroup%2Fexample"
    );
  });
});
