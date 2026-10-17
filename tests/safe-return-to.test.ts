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
});
