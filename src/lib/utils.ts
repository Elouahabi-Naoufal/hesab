import { nanoid } from "nanoid";

export function generatePublicUserId(): string {
  // usr_ + 6 chars alphanumeric
  return `usr_${nanoid(6).toUpperCase()}`;
}

export function generatePublicToken(): string {
  return nanoid(16);
}

export function generateGroupPublicToken(): string {
  return nanoid(12);
}

export function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatDH(centimes: number): string {
  if (centimes % 100 === 0) return `${(centimes / 100).toFixed(0)} DH`;
  return `${(centimes / 100).toFixed(2)} DH`;
}
