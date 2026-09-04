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
  const activeGroups = await prisma.group.count({ where: { status: "ACTIVE" } });
  const totalGroups = await prisma.group.count();
  const settledGroups = await prisma.group.count({ where: { status: "SETTLED" } });
  const totalExpenses = await prisma.expense.count();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  const products = await prisma.product.findMany({ include: { category: true } });
  const categories = await prisma.productCategory.findMany();

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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border p-4 text-center"><div className="text-2xl font-bold">{activeGroups}</div><div className="text-xs text-zinc-500">Active</div></div>
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

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border p-5">
          <h3 className="font-semibold mb-3">Products</h3>
          <form action={async (formData: FormData) => {
            "use server";
            const { prisma } = await import("@/lib/prisma");
            const name = formData.get("name") as string;
            const price = parseInt(formData.get("price") as string, 10);
            const categoryId = (formData.get("categoryId") as string) || null;
            await prisma.product.create({ data: { name, defaultPriceCentimes: price, categoryId } });
          }} className="flex gap-2 mb-3">
            <input name="name" placeholder="Product name" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm flex-1" />
            <input name="price" type="number" placeholder="price centimes" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm w-32" />
            <select name="categoryId" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm">
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm">Add</button>
          </form>
          <div className="space-y-2">
            {products.map(p => (
              <div key={p.id} className="flex justify-between text-sm p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                <span>{p.name} {p.category && `• ${p.category.name}`} {!p.active && "(inactive)"}</span>
                <span>{(p.defaultPriceCentimes / 100).toFixed(0)} DH / {p.unit}</span>
              </div>
            ))}
            {products.length === 0 && <p className="text-sm text-zinc-500">No products yet. Create Pool Table 60 DH/hour etc.</p>}
          </div>

          <h4 className="font-medium mt-4 mb-2">Categories</h4>
          <form action={async (formData: FormData) => {
            "use server";
            const { prisma } = await import("@/lib/prisma");
            const name = formData.get("name") as string;
            await prisma.productCategory.create({ data: { name } });
          }} className="flex gap-2">
            <input name="name" placeholder="Category" className="px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
            <button className="px-4 py-2 rounded-xl border text-sm">Add Category</button>
          </form>
          <div className="flex gap-2 mt-2">
            {categories.map(c => <span key={c.id} className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800">{c.name}</span>)}
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border p-5">
          <h3 className="font-semibold mb-2">System</h3>
          <p className="text-sm text-zinc-500">Database: SQLite • WAL mode enabled • Persistent volume ./data:/app/data</p>
          <p className="text-xs text-zinc-400 mt-2">Backup: copy data/app.db + WAL files using sqlite3 backup API or safe file copy after WAL checkpoint.</p>
        </div>
      </main>
    </div>
  );
}
