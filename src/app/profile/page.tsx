import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { updateProfileAction } from "@/server/profile/actions";
import AvatarPicker from "@/components/AvatarPicker";
import { avatarSrc } from "@/lib/avatar";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="header">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-brand flex items-center justify-center text-white font-bold text-sm">H</div>
            <span className="font-semibold text-[15px]">PoolSplit</span>
          </Link>
          <Link href="/dashboard" className="btn-ghost text-[13px]">Dashboard</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-8 space-y-6">
        <div className="card-elevated p-6 space-y-4">
          <h1 className="text-[20px] font-bold tracking-tight">Profile</h1>
          <div className="grid gap-3 text-[14px]">
            <div className="flex items-center gap-3">
              <span className="text-muted w-20">Public ID</span>
              <span className="font-mono bg-elevated px-2.5 py-1 rounded-[8px] text-[13px]">{user.publicId}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted w-20">Username</span>
              <span>{user.username}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted w-20">Email</span>
              <span>{user.email}</span>
            </div>
          </div>
        </div>

        <form action={async (formData: FormData) => { "use server"; await updateProfileAction(formData); }} className="card-elevated p-6 space-y-5">
          <h2 className="text-[15px] font-semibold">Edit Profile</h2>
          <AvatarPicker currentAvatar={avatarSrc(user)} displayName={user.displayName} />
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium text-muted">Display Name</label>
            <input name="displayName" defaultValue={user.displayName} required minLength={2} maxLength={50} className="input" />
          </div>
          <button className="btn-primary">Save</button>
        </form>

        <div className="card border-dashed p-6 text-center text-[13px] text-muted">
          ID <span className="font-mono text-foreground">{user.publicId}</span> is what friends use to invite you. Share it!
        </div>
      </main>
    </div>
  );
}
