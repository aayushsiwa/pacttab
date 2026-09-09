/**
 * Utility to generate robohash.org avatar URLs for users
 */
export function getRobohashUrl(seed: string, size = 120): string {
  const cleanSeed = encodeURIComponent(seed.trim().toLowerCase() || "guest");
  return `https://robohash.org/${cleanSeed}.png?size=${size}x${size}`;
}
