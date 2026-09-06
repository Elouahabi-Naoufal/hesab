import Link from "next/link";
import BackButton from "@/components/BackButton";

export default function SiteHeader({
  back,
  name,
  avatarUrl,
  isAdmin,
  action,
}: {
  back?: { href: string; label: string };
  name?: string;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <header className="header">
      <div className="header-inner">
        {back && <BackButton href={back.href} label={back.label} />}
        <Link href="/dashboard" className="flex items-center gap-2.5 mr-2">
          <div className="brand-mark">P</div>
          <span className="font-extrabold text-[15px] tracking-tight">PoolSplit</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 text-[14px] font-medium">
          <Link href="/dashboard" className="px-3 py-2 rounded-[12px] text-muted hover:text-foreground hover:bg-elevated transition-colors">Groups</Link>
          <Link href="/scan" className="px-3 py-2 rounded-[12px] text-muted hover:text-foreground hover:bg-elevated transition-colors">Scan</Link>
          <Link href="/profile" className="px-3 py-2 rounded-[12px] text-muted hover:text-foreground hover:bg-elevated transition-colors">Profile</Link>
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          {action}
          <Link href="/dashboard#new-group" className="btn-primary btn-sm">+ New</Link>
          {isAdmin && <Link href="/admin" className="tag bg-warn-subtle text-warn">Admin</Link>}
          {name && (
            <Link href="/profile" title={name} className="w-9 h-9 rounded-full overflow-hidden bg-brand-subtle text-brand flex items-center justify-center text-[13px] font-bold flex-shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                name[0]?.toUpperCase()
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
