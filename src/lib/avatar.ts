type AvatarFields = {
  avatar?: string | null;
  avatarData?: Buffer | Uint8Array | null;
  avatarMime?: string | null;
};

/**
 * Resolve a user's picture to an <img>-ready src.
 * Prefers the binary columns; falls back to the legacy `avatar` string
 * (data URL or https URL from before the binary migration).
 */
export function avatarSrc(user: AvatarFields): string | null {
  if (user.avatarData && user.avatarMime) {
    return `data:${user.avatarMime};base64,${Buffer.from(user.avatarData).toString("base64")}`;
  }
  if (user.avatar && (user.avatar.startsWith("data:") || user.avatar.startsWith("http"))) {
    return user.avatar;
  }
  return null;
}
