type AvatarFields = {
  avatar?: string | null;
};

export function avatarSrc(user: AvatarFields): string | null {
  if (user.avatar) {
    return user.avatar;
  }
  return null;
}
