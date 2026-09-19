type AvatarFields = {
  avatar?: string | null;
};

/**
 * Resolve a user's picture to an <img>-ready src.
 * If avatar field is set, serves via the API endpoint (disk-stored file).
 */
export function avatarSrc(user: AvatarFields): string | null {
  if (user.avatar) {
    return "/api/avatar";
  }
  return null;
}
