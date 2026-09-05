import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/auth/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { formatDH } from "@/lib/utils";

export default async function OutingPage({ params }: { params: Promise<{ id: string; outingId: string }> }) {
  const { id: groupId, outingId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) notFound();

  const outing = await prisma.outing.findUnique({ where: { id: outingId } });
  if (!outing || outing.groupId !== groupId) notFound();

  const participant = await prisma.outingParticipant.findUnique({
    where: { outingId_userId: { outingId, userId: session.userId } },
  });
  if (!participant) return <div className="p-10 text-center">You are not a participant in this outing.</div>;

  const isOwner = participant.role === "OWNER";

  const participants = await prisma.outingParticipant.findMany({ where: { outingId }, include: { user: true } });

  // Get all activities with their data
  const activities = await prisma.activity.findMany({
    where: { outingId },
    include: {
      products: true,
      usageRecords: { include: { participants: true, confirmations: true } },
      lineItems: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate per-activity stats
  const activityStats = activities.map(a => {
    let responsibility = 0;
    const paid = a.payments.reduce((s, p) => s + p.amountCentimes, 0);

    if (a.pricingModel === "FIXED") {
      for (const r of a.usageRecords.filter(r => r.status !== "DISPUTED")) {
        if (r.participants.length > 0) {
          const share = Math.floor(r.totalCentimes / r.participants.length);
          responsibility += share * r.participants.length;
        }
      }
    } else {
      responsibility = a.lineItems.reduce((s, l) => s + l.priceCentimes, 0);
    }

    return { ...a, responsibility, paid, balance: paid - responsibility };
  });

  const totalResponsibility = activityStats.reduce((s, a) => s + a.responsibility, 0);
  const totalPaid = activityStats.reduce((s, a) => s + a.paid, 0);

  const settlement = await prisma.settlement.findFirst({ where: { outingId } });
  const pendingInvites = await prisma.outingInvitation.findMany({ where: { outingId, status: "PENDING" } });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/groups/${groupId}`} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">←</Link>
          <div className="flex-1">
            <h1 className="font-semibold">🎯 {outing.name}</h1>
            <p className="text-xs text-zinc-500">{outing.status} • {participants.length} participants • {activities.length} activities • {formatDH(totalResponsibility)} total</p>
          </div>
          {isOwner && outing.status === "PLANNING" && (
            <form action={async () => {
              "use server";
              const { activateOutingAction } = await import("@/server/outings/actions");
              await activateOutingAction(outingId);
            }}>
              <button className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium">Activate</button>
            </form>
          )}
          {isOwner && outing.status === "ACTIVE" && (
            <Link href={`/groups/${groupId}/outings/${outingId}/settlement`} className="px-4 py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Settle</Link>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Participants */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
          <h3 className="font-semibold">Participants</h3>
          <div className="flex flex-wrap gap-2">
            {participants.map(p => (
              <span key={p.id} className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-sm">
                {p.user.displayName} {p.role === "OWNER" && <span className="text-xs text-amber-600">(owner)</span>}
              </span>
            ))}
          </div>
          {isOwner && (
            <form action={async (formData: FormData) => {
              "use server";
              const { inviteToOutingAction } = await import("@/server/outings/actions");
              const userId = formData.get("userId") as string;
              const res = await inviteToOutingAction(outingId, userId);
              if (res?.error) throw new Error(res.error);
            }} className="flex gap-2">
              <select name="userId" className="flex-1 px-3 py-2 rounded-xl border text-sm">
                <option value="">Invite group member...</option>
                {/* This would need client-side data fetching in practice */}
              </select>
              <button className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm">Invite</button>
            </form>
          )}
        </div>

        {/* Activities */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Activities</h3>
          </div>

          {activities.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-xl">
              <p className="text-sm text-zinc-500">No activities yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activityStats.map(a => (
                <div key={a.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800 space-y-3">
                  <div className="flex justify-between">
                    <div>
                      <div className="font-medium text-sm">
                        {a.pricingModel === "FIXED" ? "🎲" : "📝"} {a.name}
                        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">{a.pricingModel}</span>
                        <span className={`ml-1 text-xs px-2 py-0.5 rounded ${a.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-zinc-200 text-zinc-600"}`}>{a.status}</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Responsibility: {formatDH(a.responsibility)} • Paid: {formatDH(a.paid)} • Balance: {formatDH(a.balance)}
                      </div>
                    </div>
                    {isOwner && a.status === "OPEN" && (
                      <form action={async () => {
                        "use server";
                        const { closeActivityAction } = await import("@/server/activities/actions");
                        await closeActivityAction(a.id);
                      }}>
                        <button className="text-xs text-amber-600 hover:underline">Close</button>
                      </form>
                    )}
                  </div>

                  {/* FIXED: show products and usage records */}
                  {a.pricingModel === "FIXED" && (
                    <div className="space-y-2">
                      {a.products.length > 0 && (
                        <div className="text-xs text-zinc-500">
                          Products: {a.products.map(p => `${p.name} (${p.pricePerUnitCt / 100} DH/${p.unit})`).join(" • ")}
                        </div>
                      )}
                      {a.usageRecords.length > 0 && (
                        <div className="space-y-1">
                          {a.usageRecords.map(r => (
                            <div key={r.id} className="text-xs p-2 rounded bg-white dark:bg-zinc-900">
                              <span className={`inline-block w-2 h-2 rounded-full mr-1 ${r.status === "CONFIRMED" ? "bg-green-500" : r.status === "DISPUTED" ? "bg-red-500" : "bg-yellow-500"}`}></span>
                              {r.quantity} × {a.products.find(p => p.id === r.productId)?.name || "?"} = {formatDH(r.totalCentimes)} ({r.participants.length} people)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* VARIABLE: show line items */}
                  {a.pricingModel === "VARIABLE" && (
                    <div className="space-y-1">
                      {a.lineItems.length === 0 ? (
                        <div className="text-xs text-zinc-500 italic">No items yet</div>
                      ) : (
                        a.lineItems.map(l => (
                          <div key={l.id} className="text-xs p-2 rounded bg-white dark:bg-zinc-900 flex justify-between">
                            <span>{l.description}</span>
                            <span>{formatDH(l.priceCentimes)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Payments */}
                  {a.payments.length > 0 && (
                    <div className="text-xs text-emerald-600">
                      Paid: {a.payments.map(p => `${participants.find(pp => pp.userId === p.userId)?.user.displayName || "?"} ${formatDH(p.amountCentimes)}`).join(" • ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Create activity form */}
          {isOwner && outing.status !== "SETTLED" && (
            <details className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
              <summary className="font-medium text-sm cursor-pointer">+ Add Activity</summary>
              <form action={async (formData: FormData) => {
                "use server";
                const { createActivityAction } = await import("@/server/activities/actions");
                const res = await createActivityAction(formData);
                if (res?.error) throw new Error(res.error);
              }} className="space-y-3 mt-3">
                <input type="hidden" name="outingId" value={outingId} />
                <input name="name" placeholder="Pool / Restaurant / InDrive" required className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <select name="pricingModel" className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm">
                  <option value="FIXED">FIXED — per-unit pricing (e.g. pool, parking)</option>
                  <option value="VARIABLE">VARIABLE — custom items (e.g. restaurant)</option>
                </select>
                <input name="notes" placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800 text-sm" />
                <button className="w-full py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium">Create Activity</button>
              </form>
            </details>
          )}
        </div>

        {/* Settlement link */}
        {settlement && (
          <Link href={`/groups/${groupId}/outings/${outingId}/settlement`} className="block w-full py-3 rounded-2xl bg-amber-500 text-white text-center font-medium">
            View Settlement
          </Link>
        )}
      </main>
    </div>
  );
}
