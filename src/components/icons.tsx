type IconProps = {
  size?: number;
  className?: string;
};

function Base({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconBack({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M15 18l-6-6 6-6" />
    </Base>
  );
}

export function IconChevronRight({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M9 18l6-6-6-6" />
    </Base>
  );
}

export function IconChevronDown({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M6 9l6 6 6-6" />
    </Base>
  );
}

export function IconPlus({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function IconCheck({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M20 6L9 17l-5-5" />
    </Base>
  );
}

export function IconX({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M18 6L6 18M6 6l12 12" />
    </Base>
  );
}

export function IconPencil({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </Base>
  );
}

export function IconUsers({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Base>
  );
}

export function IconReceipt({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </Base>
  );
}

export function IconQr({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M18 18h3v3h-3z" />
    </Base>
  );
}

export function IconArrowRight({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </Base>
  );
}

export function IconWallet({ size, className }: IconProps) {
  return (
    <Base size={size} className={className}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16V7" />
      <path d="M18 12a1 1 0 0 0 0 2h0a1 1 0 0 0 0-2h0z" />
    </Base>
  );
}
