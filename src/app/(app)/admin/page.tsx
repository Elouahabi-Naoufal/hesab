import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.isAdmin) return <div className="p-10 text-center">Admin only</div>;

  const totalUsers = await prisma.user.count();
  const totalGroups = await prisma.group.count();
  const settledGroups = await prisma.group.count({ where: { status: "SETTLED" } });
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        <h1 className="font-extrabold text-[26px] tracking-tight">Admin</h1>
        <div className="flex items-center gap-5 text-[14px]">
          <span className="text-muted">Users <span className="money font-bold text-foreground ml-1">{totalUsers}</span></span>
          <span className="w-px h-4 bg-border" aria-hidden="true"></span>
          <span className="text-muted">Groups <span className="money font-bold text-foreground ml-1">{totalGroups}</span></span>
          <span className="w-px h-4 bg-border" aria-hidden="true"></span>
          <span className="text-muted">Settled <span className="money font-bold text-foreground ml-1">{settledGroups}</span></span>
        </div>
        <div>
          <h3 className="section-label mb-1">Latest users</h3>
          <div className="ledger">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 text-[14px] py-2.5">
                <span className="min-w-0 truncate">{u.displayName} · {u.username} · <span className="font-mono text-[12px]">{u.publicId}</span> {u.isAdmin && <span className="text-[12px] text-muted">(admin)</span>}</span>
                <span className="text-muted text-[13px] flex-shrink-0">{u.email}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
  );
}
