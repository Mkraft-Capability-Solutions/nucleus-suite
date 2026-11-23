/**
 * Offline avatar: initials on a neutral tile, generated in the browser.
 * Replaces the external ui-avatars.com service so employee names never leave the app.
 * SVG cannot read CSS variables, so the tile colour is a constant here.
 */
const TILE = "#2563EB";
const TEXT = "#FFFFFF";

export function avatarInitials(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase().replace(/[^\p{L}\p{N}]/gu, "") || "?";
}

export function avatarDataUri(name: string | null | undefined): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${TILE}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="600" fill="${TEXT}">${avatarInitials(name)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
