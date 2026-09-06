import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { updateProfileAction } from "@/server/profile/actions";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 font-bold">H</div>
            <span className="font-semibold">Hesab</span>
          </Link>
          <div className="flex gap-2">
            <Link href="/dashboard" className="text-sm px-3 py-1 rounded-full border">Dashboard</Link>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
          <h1 className="text-xl font-bold">Profile</h1>
          <div className="grid gap-3 text-sm">
            <div><span className="text-zinc-500">Public ID:</span> <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{user.publicId}</span></div>
            <div><span className="text-zinc-500">Username:</span> {user.username}</div>
            <div><span className="text-zinc-500">Email:</span> {user.email}</div>
          </div>
        </div>

        <form action={async (formData: FormData) => { "use server"; await updateProfileAction(formData); }} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
          <h2 className="font-semibold">Edit Profile</h2>
          <div>
            <label className="text-sm text-zinc-500">Display Name</label>
            <input name="displayName" defaultValue={user.displayName} required minLength={2} maxLength={50} className="w-full mt-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800" />
          </div>
          <div>
            <label className="text-sm text-zinc-500">Avatar URL (optional)</label>
            <input name="avatar" defaultValue={user.avatar || ""} placeholder="https://..." className="w-full mt-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800" />
          </div>
          <button className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Save</button>
        </form>

        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-dashed p-6 text-center text-sm text-zinc-500">
          ID <span className="font-mono">{user.publicId}</span> is what friends use to invite you. Share it!
        </div>
      </main>
    </div>
  );
}
