import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";

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
      <header className="sticky top-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b p-4 flex justify-between">
        <h1 className="font-bold">Admin Dashboard</h1>
        <Link href="/dashboard" className="text-sm">← Back</Link>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border p-4 text-center"><div className="text-2xl font-bold">{totalUsers}</div><div className="text-xs text-zinc-500">Users</div></div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border p-4 text-center"><div className="text-2xl font-bold">{totalGroups}</div><div className="text-xs text-zinc-500">Groups</div></div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border p-4 text-center"><div className="text-2xl font-bold">{settledGroups}</div><div className="text-xs text-zinc-500">Settled</div></div>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border p-5">
          <h3 className="font-semibold mb-3">Users</h3>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex justify-between text-sm p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                <span>{u.displayName} • {u.username} • {u.publicId} {u.isAdmin && "★"}</span>
                <span className="text-zinc-500">{u.email}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
