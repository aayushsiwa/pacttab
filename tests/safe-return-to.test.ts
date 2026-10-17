import { describe, expect, it } from "vitest";
import { safeReturnTo } from "../src/lib/safe-return-to";

describe("safeReturnTo", () => {
  it.each(["/", "/groups", "/join/invite?source=login#details"])(
    "preserves local destination %s",
    (destination) => {
      expect(safeReturnTo(destination)).toBe(destination);
    }
  );

  it.each([
    undefined,
    null,
    "",
    "groups",
    "https://example.com",
    "javascript:alert(1)",
    "//example.com",
    "///example.com",
    "/\\example.com",
    "\\example.com",
  ])("falls back for unsafe destination %s", (destination) => {
    expect(safeReturnTo(destination)).toBe("/groups");
  });

  it("rejects a decoded newline between leading slashes", () => {
    const destination = new URLSearchParams("returnTo=%2F%0A%2Fexample.com").get("returnTo");
    expect(destination).toBe("/\n/example.com");
    expect(safeReturnTo(destination)).toBe("/groups");
  });

  it.each(Array.from({ length: 33 }, (_, index) => (index === 32 ? 127 : index)))(
    "rejects control character %i in a local destination",
    (code) => {
      expect(safeReturnTo(`/groups${String.fromCharCode(code)}`)).toBe("/groups");
    }
  );
});
