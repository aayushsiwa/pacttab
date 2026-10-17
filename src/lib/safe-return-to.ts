export function safeReturnTo(value: string | null | undefined): string {
  // URL parsing can strip control characters.
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return "/groups";

  return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/groups";
}
