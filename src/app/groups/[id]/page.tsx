import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDH } from "@/lib/utils";
import { getEffectiveShares, formatPercent } from "@/domain/shares";
import QrInvite from "@/components/QrInvite";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) notFound();

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: id, userId: session.userId } } });
  if (!member) return <div className="p-10 text-center">You are not a member of this group.</div>;

  const isOwner = group.ownerId === session.userId;

  const members = await prisma.groupMember.findMany({ where: { groupId: id }, include: { user: true } });

  let effectiveShares: Array<{ userId: string; basisPoints: number; percentDisplay: string }> = [];
  try {
    effectiveShares = getEffectiveShares(members.map(m => ({ userId: m.userId, shareBasisPoints: m.shareBasisPoints })));
  } catch { effectiveShares = []; }
  const shareMap: Record<string, number> = Object.fromEntries(effectiveShares.map(s => [s.userId, s.basisPoints]));

  const outings = await prisma.outing.findMany({ where: { groupId: id }, orderBy: { createdAt: "desc" } });
  const invitations = await prisma.groupInvitation.findMany({ where: { groupId: id, status: "PENDING" } });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">←</Link>
          <div className="flex-1">
            <h1 className="font-semibold">🎱 {group.name}</h1>
            <p className="text-xs text-zinc-500">{members.length} members • {outings.length} outings</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Members */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <h3 className="font-semibold">Members</h3>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center text-sm font-bold">{m.user.displayName[0]}</div>
                  <div>
                    <div className="font-medium text-sm">{m.user.displayName} {m.role === "OWNER" && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">owner</span>} <span className="font-mono text-xs text-zinc-500">{m.user.publicId}</span></div>
                    <div className="text-xs text-zinc-500">Share: {shareMap[m.userId] !== undefined ? formatPercent(shareMap[m.userId]) : "—"} • Contrib: {formatDH(m.contribution)}</div>
                  </div>
                </div>
                {isOwner && m.userId !== group.ownerId && (
                  <form action={async () => {
                    "use server";
                    const { removeMemberAction } = await import("@/server/groups/actions");
                    await removeMemberAction(id, m.userId);
                  }}>
                    <button className="text-xs text-red-600 hover:underline">Remove</button>
                  </form>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <h4 className="font-medium text-sm">Invite Member</h4>
              <form action={async (formData: FormData) => {
                "use server";
                const { inviteMemberAction } = await import("@/server/groups/actions");
                const res = await inviteMemberAction(formData);
                if (res?.error) throw new Error(res.error);
              }} className="flex gap-2">
                <input type="hidden" name="groupId" value={id} />
                <input name="publicId" placeholder="usr_XXXXXX" required className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <button className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Invite</button>
              </form>
              {invitations.length > 0 && (
                <div className="text-xs text-zinc-500">Pending invites: {invitations.map(i => i.inviteePublicId).join(", ")}</div>
              )}
            </div>
          )}

          {/* QR Code for group */}
          {isOwner && group.publicToken && (
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <QrInvite token={group.publicToken} type="group" name={group.name} />
            </div>
          )}

          {/* Shares editor */}
          {isOwner && (
            <div className="space-y-2 pt-3 border-t border-zinc-200 dark:border-zinc-700">
              <h4 className="font-medium text-sm">Cost shares (%)</h4>
              <form action={async (formData: FormData) => {
                "use server";
                const { updateMemberSharesAction } = await import("@/server/groups/actions");
                const raw = formData.get("shares") as string;
                const res = await updateMemberSharesAction(id, raw);
                if (res?.error) throw new Error(res.error);
              }} className="space-y-2" id="shares-form">
                {members.map(m => {
                  const eff = shareMap[m.userId] ?? 0;
                  return (
                    <div key={m.userId} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{m.user.displayName}</span>
                      <input type="number" min="0" max="100" step="0.01" defaultValue={(eff / 100).toString()} data-share-for={m.userId} className="share-input w-24 px-2 py-1 rounded-lg border text-sm" />
                      <span className="text-xs text-zinc-500 w-8">%</span>
                    </div>
                  );
                })}
                <input type="hidden" name="shares" id="shares-json" />
                <button className="px-3 py-1 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Save shares</button>
              </form>
            </div>
          )}
        </div>

        {/* Outings */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Outings</h3>
            <span className="text-xs text-zinc-500">{outings.length} total</span>
          </div>

          {outings.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl">
              <p className="text-sm text-zinc-500">No outings yet.</p>
              <p className="text-xs text-zinc-400">Create the first outing to start tracking expenses.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {outings.map(o => (
                <Link key={o.id} href={`/groups/${id}/outings/${o.id}`} className="block p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium text-sm">{o.name}</div>
                      <div className="text-xs text-zinc-500">{o.status} • Created {new Date(o.createdAt).toLocaleDateString()}</div>
                    </div>
                    <span className="text-xs text-zinc-400">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {isOwner && (
            <details className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
              <summary className="font-medium text-sm cursor-pointer">+ Create Outing</summary>
              <form action={async (formData: FormData) => {
                "use server";
                const { createOutingAction } = await import("@/server/outings/actions");
                const res = await createOutingAction(formData);
                if (res?.error) throw new Error(res.error);
              }} className="space-y-3 mt-3">
                <input type="hidden" name="groupId" value={id} />
                <input name="name" placeholder="Friday Pool Night" required className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <input name="description" placeholder="Description (optional)" className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <button className="w-full py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Create Outing</button>
              </form>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}
