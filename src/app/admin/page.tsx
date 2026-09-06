import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";

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
    <div className="min-h-screen">
      <SiteHeader back={{ href: "/dashboard", label: "Back to dashboard" }} name={user.displayName} isAdmin />
      <main className="max-w-5xl mx-auto px-5 py-8 space-y-6">
        <h1 className="font-extrabold text-[26px] tracking-tight">Admin</h1>
        <div className="grid grid-cols-3 gap-3">
          <div className="card-elevated p-4 text-center">
            <div className="money text-[26px] font-bold">{totalUsers}</div>
            <div className="text-[12px] text-muted">Users</div>
          </div>
          <div className="card-elevated p-4 text-center">
            <div className="money text-[26px] font-bold">{totalGroups}</div>
            <div className="text-[12px] text-muted">Groups</div>
          </div>
          <div className="card-elevated p-4 text-center">
            <div className="money text-[26px] font-bold">{settledGroups}</div>
            <div className="text-[12px] text-muted">Settled</div>
          </div>
        </div>
        <div className="card-elevated p-5">
          <h3 className="text-[15px] font-semibold mb-3">Latest users</h3>
          <div className="space-y-1.5">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 text-[14px] py-2 px-3 rounded-[12px] bg-elevated">
                <span className="min-w-0 truncate">{u.displayName} · {u.username} · <span className="font-mono text-[12px]">{u.publicId}</span> {u.isAdmin && <span className="text-[12px] text-muted">(admin)</span>}</span>
                <span className="text-muted text-[13px] flex-shrink-0">{u.email}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
